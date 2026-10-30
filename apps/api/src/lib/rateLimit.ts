import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { redis } from "./redis.js";

export interface BumpResult {
  count: number;
  /** seconds until the window resets */
  retryAfter: number;
}

/** Fixed-window counter, atomic in Redis. Returns the new count. */
export async function bumpCounter(key: string, windowSeconds: number): Promise<BumpResult> {
  const [count, ttl] = await redis.rateBump(`rl:${key}`, windowSeconds);
  return { count, retryAfter: Math.max(1, ttl) };
}

/** Reads a counter without changing it. */
export async function peekCounter(key: string): Promise<number> {
  return Number((await redis.get(`rl:${key}`)) ?? 0);
}

/** Keys with personal data (emails) are hashed before they reach Redis. */
export const hashKey = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 32);

interface LimitRule {
  /** counter namespace, e.g. "login:ip" */
  name: string;
  limit: number;
  windowSeconds: number;
  /** what to count by; return null to skip this rule for the request */
  by: (req: Request) => string | null | undefined;
}

/**
 * Express middleware enforcing several fixed-window rules at once (e.g. per IP
 * AND per account). Every rule is counted even when an earlier one trips, so
 * one noisy source can't hide behind another.
 */
export function rateLimit(...rules: LimitRule[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let blockedFor = 0;
    for (const rule of rules) {
      const who = rule.by(req);
      if (!who) continue;
      const { count, retryAfter } = await bumpCounter(`${rule.name}:${who}`, rule.windowSeconds);
      if (count > rule.limit) blockedFor = Math.max(blockedFor, retryAfter);
    }
    if (blockedFor > 0) {
      res.setHeader("Retry-After", String(blockedFor));
      return res.sendResponse(429, null, "Too many attempts. Please try again later.");
    }
    next();
  };
}

/** Client IP as Express sees it (honours TRUST_PROXY). */
export const clientIp = (req: Request) => req.ip ?? req.socket.remoteAddress ?? "unknown";
