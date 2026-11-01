import { Router } from "express";
import { clientIp, hashKey, rateLimit } from "../../lib/rateLimit.js";
import { requireAuth } from "../../middlewares/authorization.middlewares.js";
import * as controllers from "./controllers.js";

const router = Router();

const emailOf = (body: unknown): string | null => {
  const email = (body as { email?: unknown } | null)?.email;
  return typeof email === "string" && email.length < 320 ? hashKey(email.trim().toLowerCase()) : null;
};

router.get("/providers", controllers.providers);

// Brute-force and credential-stuffing protection: count by network address AND by
// target account, so neither a botnet (many IPs, one account) nor one machine
// (one IP, many accounts) gets unlimited tries.
router.post(
  "/login",
  rateLimit(
    { name: "login:ip", limit: 30, windowSeconds: 600, by: clientIp },
    { name: "login:acct", limit: 8, windowSeconds: 600, by: (req) => emailOf(req.body) },
  ),
  controllers.login,
);
router.post(
  "/register",
  rateLimit(
    { name: "register:ip", limit: 10, windowSeconds: 3600, by: clientIp },
    { name: "register:email", limit: 3, windowSeconds: 3600, by: (req) => emailOf(req.body) },
  ),
  controllers.register,
);
router.get(
  "/google/complete",
  rateLimit({ name: "google:ip", limit: 30, windowSeconds: 600, by: clientIp }),
  controllers.googleComplete,
);

router.post(
  "/refresh",
  requireAuth,
  rateLimit({ name: "refresh:user", limit: 120, windowSeconds: 3600, by: (req) => req.auth?.id }),
  controllers.refresh,
);
// Someone holding a stolen token must not be able to guess the current password at leisure.
router.post(
  "/change-password",
  requireAuth,
  rateLimit(
    { name: "pwchange:user", limit: 5, windowSeconds: 600, by: (req) => req.auth?.id },
    { name: "pwchange:ip", limit: 30, windowSeconds: 600, by: clientIp },
  ),
  controllers.changePassword,
);
router.post("/logout-everywhere", requireAuth, controllers.logoutEverywhere);

export default router;
