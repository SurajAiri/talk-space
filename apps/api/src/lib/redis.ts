import { Redis } from "ioredis";
import { env } from "../config/env.js";

// Redis holds temporary data only (rooms/spaces). Anything that must survive
// a restart belongs in PostgreSQL.
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });

redis.on("error", (err) => console.error("Redis error:", err.message));
