import { timingSafeEqual } from "node:crypto";
import { redis } from "../../lib/redis.js";
import { bumpCounter, peekCounter } from "../../lib/rateLimit.js";
import { ROOM_CONFIG } from "../../config/rooms.config.js";
import { generateRoomId } from "./ids.js";
import type { Member, PeerProfile, RoomMeta } from "./types.js";

/**
 * Everything about rooms lives in Redis; nothing is written to Postgres.
 *
 *   room:{id}           JSON RoomMeta (SET NX; TTL only while the room is empty)
 *   room:{id}:members   hash userId -> JSON Member (O(1) membership + count)
 *   room:{id}:banned    set of userIds the creator removed (expires on its own)
 *   rooms:public        set of public room ids (listing index, cleaned lazily)
 *   rl:*                short-lived counters for rate limiting
 */
const metaKey = (id: string) => `room:${id}`;
const membersKey = (id: string) => `room:${id}:members`;
const bannedKey = (id: string) => `room:${id}:banned`;
const PUBLIC_INDEX = "rooms:public";

export async function createRoom(
  input: Omit<RoomMeta, "id" | "createdAt" | "maxMembers">,
): Promise<RoomMeta> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const meta: RoomMeta = {
      ...input,
      id: generateRoomId(),
      maxMembers: ROOM_CONFIG.maxMembers,
      createdAt: Date.now(),
    };
    const ok = await redis.set(
      metaKey(meta.id),
      JSON.stringify(meta),
      "EX",
      ROOM_CONFIG.createJoinWindowSeconds,
      "NX",
    );
    if (ok === "OK") {
      if (meta.visibility === "public") await redis.sadd(PUBLIC_INDEX, meta.id);
      return meta;
    }
  }
  throw new Error("Could not allocate a room id");
}

export async function getMeta(id: string): Promise<RoomMeta | null> {
  const raw = await redis.get(metaKey(id));
  return raw ? (JSON.parse(raw) as RoomMeta) : null;
}

export async function participantCount(id: string): Promise<number> {
  return redis.hlen(membersKey(id));
}

export async function listMembers(id: string): Promise<Member[]> {
  const raw = await redis.hvals(membersKey(id));
  return raw.map((r) => JSON.parse(r) as Member);
}

export function toPeer(m: Member): PeerProfile {
  return { id: m.id, name: m.name, username: m.username };
}

export type JoinResult =
  | { status: "joined"; previous: Member | null }
  | { status: "not_found" | "full" | "banned" };

export async function addMember(meta: RoomMeta, member: Member): Promise<JoinResult> {
  const [status, prev] = await redis.roomJoin(
    metaKey(meta.id),
    membersKey(meta.id),
    PUBLIC_INDEX,
    bannedKey(meta.id),
    member.id,
    JSON.stringify(member),
    meta.maxMembers,
  );
  if (status === -1) return { status: "not_found" };
  if (status === -2) return { status: "full" };
  if (status === -3) return { status: "banned" };
  return { status: "joined", previous: prev ? (JSON.parse(prev) as Member) : null };
}

/** Returns true if this socket actually held the seat and was removed. */
export async function removeMember(
  roomId: string,
  userId: string,
  socketId: string,
  graceSeconds: number,
): Promise<boolean> {
  const remaining = await redis.roomLeave(
    metaKey(roomId),
    membersKey(roomId),
    PUBLIC_INDEX,
    userId,
    socketId,
    graceSeconds,
    roomId,
  );
  return remaining >= 0;
}

export async function getMember(roomId: string, userId: string): Promise<Member | null> {
  const raw = await redis.hget(membersKey(roomId), userId);
  return raw ? (JSON.parse(raw) as Member) : null;
}

/**
 * Removes a person from the room and bans them from re-joining for a while.
 * Returns the socket id that held their seat, or null if they were not inside.
 */
export async function kickMember(roomId: string, userId: string): Promise<string | null> {
  const socketId = await redis.roomKick(
    metaKey(roomId),
    membersKey(roomId),
    PUBLIC_INDEX,
    bannedKey(roomId),
    userId,
    ROOM_CONFIG.kickBanSeconds,
    ROOM_CONFIG.emptyGraceSeconds,
    roomId,
  );
  return socketId || null;
}

/** Every room that currently has (or recently had) members. Used by the ghost-seat sweeper. */
export async function* scanRoomIds(): AsyncGenerator<string> {
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", "room:*:members", "COUNT", 100);
    cursor = next;
    // "room:ABCDEF:members" -> "ABCDEF"
    for (const key of keys) yield key.slice("room:".length, -":members".length);
  } while (cursor !== "0");
}

export interface PublicRoomFilter {
  language?: string;
  purpose?: string;
  tags?: string[];
  q?: string;
  hasSpace?: boolean;
  limit: number;
}

type ListedRoom = RoomMeta & { participantCount: number };

/**
 * Every lobby refresh would otherwise read every public room from Redis. The raw
 * snapshot is shared for a moment, and filtering happens on the copy, so the
 * cost no longer grows with the number of people looking at the lobby.
 */
const SNAPSHOT_TTL_MS = 2000;
let snapshot: { at: number; rooms: ListedRoom[] } | null = null;
let snapshotLoading: Promise<ListedRoom[]> | null = null;

async function loadPublicRooms(): Promise<ListedRoom[]> {
  if (snapshot && Date.now() - snapshot.at < SNAPSHOT_TTL_MS) return snapshot.rooms;
  snapshotLoading ??= readPublicRooms()
    .then((rooms) => {
      snapshot = { at: Date.now(), rooms };
      return rooms;
    })
    .finally(() => {
      snapshotLoading = null;
    });
  return snapshotLoading;
}

async function readPublicRooms(): Promise<ListedRoom[]> {
  const ids = await redis.smembers(PUBLIC_INDEX);
  if (ids.length === 0) return [];

  const pipe = redis.pipeline();
  for (const id of ids) {
    pipe.get(metaKey(id));
    pipe.hlen(membersKey(id));
  }
  const res = (await pipe.exec()) ?? [];

  const stale: string[] = [];
  const rooms: ListedRoom[] = [];
  ids.forEach((id, i) => {
    const raw = res[i * 2]?.[1] as string | null;
    const count = Number(res[i * 2 + 1]?.[1] ?? 0);
    if (!raw) return void stale.push(id); // expired or deleted
    rooms.push({ ...(JSON.parse(raw) as RoomMeta), participantCount: count });
  });
  if (stale.length) await redis.srem(PUBLIC_INDEX, ...stale);
  return rooms;
}

export async function listPublic(filter: PublicRoomFilter): Promise<ListedRoom[]> {
  const rooms = await loadPublicRooms();
  const q = filter.q?.toLowerCase();
  return rooms
    .filter((r) => r.participantCount > 0) // hides rooms nobody has entered yet
    .filter((r) => !filter.language || r.language === filter.language)
    .filter((r) => !filter.purpose || r.purpose === filter.purpose)
    .filter((r) => !filter.tags?.length || filter.tags.some((t) => r.tags.includes(t)))
    .filter((r) => !filter.hasSpace || r.participantCount < r.maxMembers)
    .filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.shortDescription.toLowerCase().includes(q) ||
        r.tags.some((t) => t.includes(q)),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, filter.limit);
}

/** Fixed-window counter (atomic in Redis). Returns the new count. */
export async function bump(key: string, windowSeconds: number): Promise<number> {
  return (await bumpCounter(key, windowSeconds)).count;
}

export function bumpCounterFor(key: string, windowSeconds: number) {
  return bumpCounter(key, windowSeconds);
}

export function peek(key: string): Promise<number> {
  return peekCounter(key);
}

export function codesMatch(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
