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

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);

  // never hang forever on a stuck connection
  const force = setTimeout(() => {
    console.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);
  force.unref();

  try {
    // stop taking new HTTP requests, then drop sockets (this also closes the HTTP server)
    server.closeIdleConnections();
    await io.closeAll();
    await Promise.allSettled([pool.end(), redis.quit()]);
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
