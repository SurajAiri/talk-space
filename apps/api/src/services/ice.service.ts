import { createHmac } from "node:crypto";
import { env } from "../config/env.js";

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/** The slice of config buildIceServers needs (a parameter so tests can pass their own). */
export type IceConfig = Pick<
  typeof env,
  | "STUN_URLS"
  | "TURN_URLS"
  | "TURN_SECRET"
  | "TURN_USERNAME"
  | "TURN_CREDENTIAL"
  | "TURN_TTL_SECONDS"
>;

/**
 * STUN always; TURN only when configured. Two credential modes (see env.ts):
 *
 * - shared secret (coturn "use-auth-secret" / TURN REST API scheme): short-lived, per-user
 *   credentials, so the secret never reaches the browser and leaked credentials expire on their own.
 * - static login (hosted providers' free tiers, e.g. ExpressTURN): the provider's fixed
 *   username/password is sent as-is. Weaker: every joined user's browser can read it, and it
 *   does not expire. It is only ever sent to authenticated users who joined a room, but treat it
 *   as leakable: watch the provider's usage page and rotate it if the quota burns down.
 */
export function buildIceServers(
  userId: string,
  cfg: IceConfig = env,
  nowMs: number = Date.now(),
): IceServer[] {
  const servers: IceServer[] = [];
  if (cfg.STUN_URLS.length) servers.push({ urls: [...cfg.STUN_URLS] });
  if (cfg.TURN_URLS.length === 0) return servers;

  if (cfg.TURN_USERNAME && cfg.TURN_CREDENTIAL) {
    servers.push({
      urls: [...cfg.TURN_URLS],
      username: cfg.TURN_USERNAME,
      credential: cfg.TURN_CREDENTIAL,
    });
  } else if (cfg.TURN_SECRET) {
    const expiry = Math.floor(nowMs / 1000) + cfg.TURN_TTL_SECONDS;
    const username = `${expiry}:${userId}`;
    const credential = createHmac("sha1", cfg.TURN_SECRET).update(username).digest("base64");
    servers.push({ urls: [...cfg.TURN_URLS], username, credential });
  }
  return servers;
}
