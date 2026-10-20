import { timingSafeEqual } from "node:crypto";
import { redis } from "../../lib/redis.js";
import { ROOM_CONFIG } from "../../config/rooms.config.js";
import { generateRoomId } from "./ids.js";
import type { Member, PeerProfile, RoomMeta } from "./types.js";

/**
 * Everything about rooms lives in Redis; nothing is written to Postgres.
 *
 *   room:{id}           JSON RoomMeta (SET NX; TTL only while the room is empty)
 *   room:{id}:members   hash userId -> JSON Member (O(1) membership + count)
 *   rooms:public        set of public room ids (listing index, cleaned lazily)
 *   rl:*                short-lived counters for rate limiting
 */
const metaKey = (id: string) => `room:${id}`;
const membersKey = (id: string) => `room:${id}:members`;
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
  | { status: "not_found" | "full" };

export async function addMember(meta: RoomMeta, member: Member): Promise<JoinResult> {
  const [status, prev] = await redis.roomJoin(
    metaKey(meta.id),
    membersKey(meta.id),
    PUBLIC_INDEX,
    member.id,
    JSON.stringify(member),
    meta.maxMembers,
  );
  if (status === -1) return { status: "not_found" };
  if (status === -2) return { status: "full" };
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

export interface PublicRoomFilter {
  language?: string;
  purpose?: string;
  tags?: string[];
  q?: string;
  hasSpace?: boolean;
  limit: number;
}

export async function listPublic(
  filter: PublicRoomFilter,
): Promise<(RoomMeta & { participantCount: number })[]> {
  const ids = await redis.smembers(PUBLIC_INDEX);
  if (ids.length === 0) return [];

  const pipe = redis.pipeline();
  for (const id of ids) {
    pipe.get(metaKey(id));
    pipe.hlen(membersKey(id));
  }
  const res = (await pipe.exec()) ?? [];

  const stale: string[] = [];
  const rooms: (RoomMeta & { participantCount: number })[] = [];
  ids.forEach((id, i) => {
    const raw = res[i * 2]?.[1] as string | null;
    const count = Number(res[i * 2 + 1]?.[1] ?? 0);
    if (!raw) return void stale.push(id); // expired or deleted
    rooms.push({ ...(JSON.parse(raw) as RoomMeta), participantCount: count });
  });
  if (stale.length) await redis.srem(PUBLIC_INDEX, ...stale);

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

/** Fixed-window counter. Returns the new count. */
export async function bump(key: string, windowSeconds: number): Promise<number> {
  const k = `rl:${key}`;
  const count = await redis.incr(k);
  if (count === 1) await redis.expire(k, windowSeconds);
  return count;
}

export async function peek(key: string): Promise<number> {
  return Number((await redis.get(`rl:${key}`)) ?? 0);
}

export function codesMatch(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
