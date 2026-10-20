import { Router } from "express";
import { requireAuth } from "../../middlewares/authorization.middlewares.js";
import * as controllers from "./controllers.js";

const router = Router();

router.get("/me", requireAuth, controllers.getMe);

export default router;
