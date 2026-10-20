import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";

try {
  await pool.query("select 1");
  console.log("Connected to PostgreSQL");
} catch (err) {
  console.error("Failed to connect to PostgreSQL", err);
  process.exit(1);
}

const server = app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
