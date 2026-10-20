import { createHmac } from "node:crypto";
import { env } from "../config/env.js";

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/**
 * STUN always; TURN only when configured. TURN credentials are short-lived
 * (coturn "use-auth-secret" / TURN REST API scheme), so the secret never
 * reaches the browser and leaked credentials expire on their own.
 */
export function buildIceServers(userId: string): IceServer[] {
  const servers: IceServer[] = [];
  if (env.STUN_URLS.length) servers.push({ urls: env.STUN_URLS });

  if (env.TURN_URLS.length && env.TURN_SECRET) {
    const expiry = Math.floor(Date.now() / 1000) + env.TURN_TTL_SECONDS;
    const username = `${expiry}:${userId}`;
    const credential = createHmac("sha1", env.TURN_SECRET).update(username).digest("base64");
    servers.push({ urls: env.TURN_URLS, username, credential });
  }
  return servers;
}
