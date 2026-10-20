import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";
import { redis } from "./lib/redis.js";
import { createSocketServer } from "./realtime/socket.js";

try {
  await pool.query("select 1");
  console.log("Connected to PostgreSQL");
} catch (err) {
  console.error("Failed to connect to PostgreSQL", err);
  process.exit(1);
}

try {
  await redis.ping();
  console.log("Connected to Redis");
} catch (err) {
  console.error("Failed to connect to Redis", err);
  process.exit(1);
}

const server = createServer(app);
const io = createSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  void io.close(async () => {
    await Promise.allSettled([pool.end(), redis.quit()]);
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
