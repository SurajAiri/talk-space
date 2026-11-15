import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

export const pool = new Pool({ connectionString: env.DATABASE_URL });
// A pooled connection that sits idle can die: database restart or failover, a dropped network, a managed
// database scaling to zero. node-postgres reports that as an 'error' event on the pool, and an 'error' event
// nobody listens for is an uncaught exception: it killed the whole API (and with it every WebSocket). The pool
// discards the broken connection and opens a new one on the next query, so logging is all that is needed.
pool.on("error", (err) => console.error("PostgreSQL pool error:", err.message));
export const db = drizzle({ client: pool, schema });
