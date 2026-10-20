import { randomInt, timingSafeEqual } from "node:crypto";
import { redis } from "../../lib/redis.js";
import { AppError } from "../../utils/errors.js";
import * as userService from "../user/services.js";
import {
  CODE_ATTEMPT_WINDOW_S,
  HEARTBEAT_INTERVAL_MS,
  JOIN_CODE_LENGTH,
  MAX_CODE_ATTEMPTS,
  ROOM_ID_ALPHABET,
  ROOM_ID_LENGTH,
  ROOM_IDLE_TTL_MS,
  STALE_AFTER_MS,
  type RoomPurpose,
  type RoomVisibility,
} from "./constants.js";
import type { CreateRoomInput } from "./schemas.js";

/*
 * Redis layout (all temporary):
 *   room:{ID}           hash  – room details (+ joinCode for private rooms)
 *   room:{ID}:members   zset  – userId -> last-seen (ms)
 *   rooms:public        set   – IDs of public rooms (what the list reads)
 *   room:{ID}:tries:{u} str   – wrong join-code counter (expires)
 *
 * Anything that must read-modify-write several keys runs as a Lua script so
 * it is atomic (capacity checks, "destroy when empty").
 */
const roomKey = (id: string) => `room:${id}`;
const membersKey = (id: string) => `room:${id}:members`;
const triesKey = (id: string, userId: string) => `room:${id}:tries:${userId}`;
const PUBLIC_SET = "rooms:public";

// KEYS: room, members, publicSet | ARGV: roomId, now, creatorId, isPublic, ttl, ...hashFields
const CREATE_LUA = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
local fields = {}
for i = 6, #ARGV do fields[#fields + 1] = ARGV[i] end
redis.call('HSET', KEYS[1], unpack(fields))
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[3])
if ARGV[4] == '1' then redis.call('SADD', KEYS[3], ARGV[1]) end
redis.call('PEXPIRE', KEYS[1], ARGV[5])
redis.call('PEXPIRE', KEYS[2], ARGV[5])
return 1
`;

// Drops stale members; destroys the room if nobody is left.
// Returns -1 if the room doesn't exist, 0 if it was destroyed, else member count.
// KEYS: room, members, publicSet | ARGV: roomId, staleBefore
const REAP_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('DEL', KEYS[2])
  redis.call('SREM', KEYS[3], ARGV[1])
  return -1
end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', '(' .. ARGV[2])
local n = redis.call('ZCARD', KEYS[2])
if n == 0 then
  redis.call('DEL', KEYS[1], KEYS[2])
  redis.call('SREM', KEYS[3], ARGV[1])
  return 0
end
return n
`;

// Returns 1 joined, -1 room missing, -2 room full.
// KEYS: room, members | ARGV: userId, now, staleBefore, ttl
const JOIN_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', '(' .. ARGV[3])
if not redis.call('ZSCORE', KEYS[2], ARGV[1]) then
  local max = tonumber(redis.call('HGET', KEYS[1], 'maxParticipants'))
  if redis.call('ZCARD', KEYS[2]) >= max then return -2 end
end
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[1])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
redis.call('PEXPIRE', KEYS[2], ARGV[4])
return 1
`;

// Returns 1 if this call destroyed the room (it became empty), else 0.
// KEYS: room, members, publicSet | ARGV: roomId, userId, staleBefore
const LEAVE_LUA = `
local existed = redis.call('EXISTS', KEYS[1])
redis.call('ZREM', KEYS[2], ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', '(' .. ARGV[3])
if redis.call('ZCARD', KEYS[2]) == 0 then
  redis.call('DEL', KEYS[1], KEYS[2])
  redis.call('SREM', KEYS[3], ARGV[1])
  return existed
end
return 0
`;

// Returns 1 if the user is a member (and refreshes them), else 0.
// KEYS: room, members | ARGV: userId, now, ttl
const HEARTBEAT_LUA = `
if not redis.call('ZSCORE', KEYS[2], ARGV[1]) then return 0 end
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[1])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
redis.call('PEXPIRE', KEYS[2], ARGV[3])
return 1
`;

// ---------------------------------------------------------------------------

interface StoredRoom {
  id: string;
  title: string;
  description: string;
  language: string;
  purpose: RoomPurpose;
  tags: string[];
  visibility: RoomVisibility;
  maxParticipants: number;
  createdBy: string;
  createdAt: number;
  joinCode?: string;
}

const staleBefore = () => Date.now() - STALE_AFTER_MS;

function generateRoomId(): string {
  let id = "";
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_ALPHABET[randomInt(ROOM_ID_ALPHABET.length)];
  }
  return id;
}

function generateJoinCode(): string {
  return randomInt(10 ** JOIN_CODE_LENGTH).toString().padStart(JOIN_CODE_LENGTH, "0");
}

function codesMatch(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function fromHash(h: Record<string, string>): StoredRoom | null {
  if (!h.id) return null;
  return {
    id: h.id,
    title: h.title ?? "",
    description: h.description ?? "",
    language: h.language ?? "",
    purpose: (h.purpose ?? "misc") as RoomPurpose,
    tags: JSON.parse(h.tags ?? "[]") as string[],
    visibility: (h.visibility ?? "public") as RoomVisibility,
    maxParticipants: Number(h.maxParticipants),
    createdBy: h.createdBy ?? "",
    createdAt: Number(h.createdAt),
    joinCode: h.joinCode,
  };
}

async function ensureActiveUser(userId: string) {
  const status = await userService.findUserStatus(userId);
  if (!status) throw new AppError(401, "User no longer exists");
  if (status !== "active") throw new AppError(403, `Account is ${status}`);
}

/** Runs REAP for a room and returns its member count (0 = destroyed/missing). */
async function reap(id: string): Promise<number> {
  const n = (await redis.eval(
    REAP_LUA, 3, roomKey(id), membersKey(id), PUBLIC_SET, id, staleBefore(),
  )) as number;
  return Math.max(n, 0);
}

/** Loads a room that is known to exist (after reaping stale members). */
async function loadLiveRoom(id: string) {
  const count = await reap(id);
  if (count === 0) throw new AppError(404, "Room not found");
  const room = fromHash(await redis.hgetall(roomKey(id)));
  if (!room) throw new AppError(404, "Room not found"); // expired in between
  return { room, count };
}

// ---- response shaping ------------------------------------------------------

type PersonRef = { id: string; name: string | null; username: string | null };

function toSummary(room: StoredRoom, participantCount: number, host: PersonRef) {
  return {
    id: room.id,
    title: room.title,
    description: room.description,
    language: room.language,
    purpose: room.purpose,
    tags: room.tags,
    visibility: room.visibility,
    maxParticipants: room.maxParticipants,
    participantCount,
    isFull: participantCount >= room.maxParticipants,
    host,
    createdAt: new Date(room.createdAt).toISOString(),
  };
}

async function peopleById(ids: string[]) {
  const found = await userService.findPublicUsersByIds([...new Set(ids)]);
  const map = new Map(found.map((u) => [u.id, u]));
  return (id: string): PersonRef => map.get(id) ?? { id, name: null, username: null };
}

async function buildDetail(room: StoredRoom, viewerId: string) {
  const memberIds = await redis.zrange(membersKey(room.id), "0", "-1"); // oldest first
  const person = await peopleById([...memberIds, room.createdBy]);
  return {
    ...toSummary(room, memberIds.length, person(room.createdBy)),
    // host first, then A-Z: stable order (member order in Redis shifts with heartbeats)
    participants: memberIds
      .map(person)
      .sort(
        (a, b) =>
          Number(b.id === room.createdBy) - Number(a.id === room.createdBy) ||
          (a.username ?? a.id).localeCompare(b.username ?? b.id),
      ),
    isMember: memberIds.includes(viewerId),
    // only the host can see/share the code
    ...(room.visibility === "private" && room.createdBy === viewerId
      ? { joinCode: room.joinCode }
      : {}),
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  };
}

// ---- public API ------------------------------------------------------------

export async function createRoom(userId: string, input: CreateRoomInput) {
  await ensureActiveUser(userId);

  const isPublic = input.visibility === "public";
  const now = Date.now();
  const joinCode = isPublic ? undefined : generateJoinCode();

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateRoomId();
    const fields: Record<string, string> = {
      id,
      title: input.title,
      description: input.description,
      language: input.language,
      purpose: input.purpose,
      tags: JSON.stringify(input.tags),
      visibility: input.visibility,
      maxParticipants: String(input.maxParticipants),
      createdBy: userId,
      createdAt: String(now),
      ...(joinCode ? { joinCode } : {}),
    };

    const created = await redis.eval(
      CREATE_LUA, 3, roomKey(id), membersKey(id), PUBLIC_SET,
      id, now, userId, isPublic ? "1" : "0", ROOM_IDLE_TTL_MS,
      ...Object.entries(fields).flat(),
    );
    if (created === 1) {
      const room = fromHash(fields)!;
      return buildDetail(room, userId);
    }
  }
  throw new AppError(500, "Could not allocate a room ID, please try again");
}

/** All public rooms, newest first. Filtering is left to the client. */
export async function listPublicRooms() {
  const ids = await redis.smembers(PUBLIC_SET);
  if (ids.length === 0) return [];

  // 1) drop stale members / destroy dead rooms, get live member counts
  const reaped = redis.pipeline();
  const t = staleBefore();
  for (const id of ids) {
    reaped.eval(REAP_LUA, 3, roomKey(id), membersKey(id), PUBLIC_SET, id, t);
  }
  const counts = (await reaped.exec()) ?? [];
  const live = ids
    .map((id, i) => ({ id, count: Number(counts[i]?.[1] ?? 0) }))
    .filter((r) => r.count > 0);
  if (live.length === 0) return [];

  // 2) fetch the surviving rooms
  const fetched = redis.pipeline();
  for (const r of live) fetched.hgetall(roomKey(r.id));
  const hashes = (await fetched.exec()) ?? [];

  const rooms = live.flatMap((r, i) => {
    const room = fromHash((hashes[i]?.[1] ?? {}) as Record<string, string>);
    return room ? [{ room, count: r.count }] : [];
  });

  const person = await peopleById(rooms.map((r) => r.room.createdBy));
  return rooms
    .map(({ room, count }) => toSummary(room, count, person(room.createdBy)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Public room or a room you're in -> full details.
 * Private room you're not in -> a minimal preview (enough to show a "enter code" screen).
 */
export async function getRoom(roomId: string, viewerId: string) {
  const { room } = await loadLiveRoom(roomId);
  const isMember = (await redis.zscore(membersKey(roomId), viewerId)) !== null;

  if (room.visibility === "private" && !isMember && room.createdBy !== viewerId) {
    const count = await redis.zcard(membersKey(roomId));
    return {
      id: room.id,
      visibility: room.visibility,
      requiresCode: true,
      isFull: count >= room.maxParticipants,
    };
  }
  return buildDetail(room, viewerId);
}

export async function joinRoom(roomId: string, userId: string, code?: string) {
  await ensureActiveUser(userId);
  const { room } = await loadLiveRoom(roomId);

  // Public rooms are open. Private rooms need the code (the host doesn't).
  if (room.visibility === "private" && room.createdBy !== userId) {
    const alreadyIn = (await redis.zscore(membersKey(roomId), userId)) !== null;
    if (!alreadyIn) await checkJoinCode(room, userId, code);
  }

  const result = (await redis.eval(
    JOIN_LUA, 2, roomKey(roomId), membersKey(roomId),
    userId, Date.now(), staleBefore(), ROOM_IDLE_TTL_MS,
  )) as number;
  if (result === -1) throw new AppError(404, "Room not found");
  if (result === -2) throw new AppError(409, "Room is full");

  const fresh = await loadLiveRoom(roomId);
  return buildDetail(fresh.room, userId);
}

async function checkJoinCode(room: StoredRoom, userId: string, code?: string) {
  if (!code) throw new AppError(403, "This room is private: a join code is required");

  const key = triesKey(room.id, userId);
  const tries = Number((await redis.get(key)) ?? 0);
  if (tries >= MAX_CODE_ATTEMPTS) {
    throw new AppError(429, "Too many wrong codes. Try again in a few minutes.");
  }

  if (!room.joinCode || !codesMatch(code, room.joinCode)) {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, CODE_ATTEMPT_WINDOW_S);
    throw new AppError(403, "Incorrect join code");
  }
  await redis.del(key);
}

/** Idempotent. Destroys the room when the last person leaves. */
export async function leaveRoom(roomId: string, userId: string) {
  const destroyed = (await redis.eval(
    LEAVE_LUA, 3, roomKey(roomId), membersKey(roomId), PUBLIC_SET,
    roomId, userId, staleBefore(),
  )) as number;
  return { left: true, roomDestroyed: destroyed === 1 };
}

/** Keeps the caller's presence alive. 404 means "you're no longer in this room". */
export async function heartbeat(roomId: string, userId: string) {
  const ok = (await redis.eval(
    HEARTBEAT_LUA, 2, roomKey(roomId), membersKey(roomId),
    userId, Date.now(), ROOM_IDLE_TTL_MS,
  )) as number;
  if (ok !== 1) throw new AppError(404, "You are not in this room");
  return { ok: true };
}
