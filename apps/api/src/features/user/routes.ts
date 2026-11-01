import { Router } from "express";
import { clientIp, rateLimit } from "../../lib/rateLimit.js";
import { requireAuth } from "../../middlewares/authorization.middlewares.js";
import * as controllers from "./controllers.js";

const router = Router();

// Editing a profile is cheap, but there is no reason to allow thousands of writes an hour.
const writeLimit = rateLimit(
  { name: "profile:user", limit: 60, windowSeconds: 3600, by: (req) => req.auth?.id },
  { name: "profile:ip", limit: 200, windowSeconds: 3600, by: clientIp },
);

router.get("/options", requireAuth, controllers.getOptions);
router.get("/me", requireAuth, controllers.getMe);
router.patch("/me", requireAuth, writeLimit, controllers.updateMe);
router.post("/me/onboarding", requireAuth, writeLimit, controllers.completeOnboarding);
router.post("/me/privacy-policy", requireAuth, writeLimit, controllers.acceptPrivacyPolicy);

export default router;
