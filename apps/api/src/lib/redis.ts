import { Redis, type Result } from "ioredis";
import { env } from "../config/env.js";

/**
 * Atomic room operations as Lua scripts, so capacity checks and membership
 * changes can't race between concurrent joins/leaves.
 */

// KEYS: meta, members, publicIndex | ARGV: userId, memberJson, max
// -> [status, previousMemberJson]   status: 1 joined, -1 no such room, -2 full
const JOIN = `
if redis.call('EXISTS', KEYS[1]) == 0 then return {-1, ''} end
local prev = redis.call('HGET', KEYS[2], ARGV[1])
if not prev and redis.call('HLEN', KEYS[2]) >= tonumber(ARGV[3]) then return {-2, ''} end
redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])
redis.call('PERSIST', KEYS[1])
return {1, prev or ''}
`;

// KEYS: meta, members, publicIndex | ARGV: userId, socketId, graceSeconds, roomId
// -> remaining members, or -1 if this socket doesn't hold the user's seat
// (e.g. an old tab disconnecting after the same user re-joined elsewhere)
const LEAVE = `
local cur = redis.call('HGET', KEYS[2], ARGV[1])
if not cur then return -1 end
if cjson.decode(cur).socketId ~= ARGV[2] then return -1 end
redis.call('HDEL', KEYS[2], ARGV[1])
local remaining = redis.call('HLEN', KEYS[2])
if remaining == 0 then
  if tonumber(ARGV[3]) <= 0 then
    redis.call('DEL', KEYS[1], KEYS[2])
    redis.call('SREM', KEYS[3], ARGV[4])
  else
    redis.call('EXPIRE', KEYS[1], ARGV[3])
  end
end
return remaining
`;

declare module "ioredis" {
  interface RedisCommander<Context> {
    roomJoin(
      metaKey: string,
      membersKey: string,
      publicIndexKey: string,
      userId: string,
      memberJson: string,
      max: number,
    ): Result<[number, string], Context>;
    roomLeave(
      metaKey: string,
      membersKey: string,
      publicIndexKey: string,
      userId: string,
      socketId: string,
      graceSeconds: number,
      roomId: string,
    ): Result<number, Context>;
  }
}

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
redis.on("error", (err) => console.error("Redis error:", err.message));

redis.defineCommand("roomJoin", { numberOfKeys: 3, lua: JOIN });
redis.defineCommand("roomLeave", { numberOfKeys: 3, lua: LEAVE });
