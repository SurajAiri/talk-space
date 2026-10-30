import { Router } from "express";
import { requireAuth } from "../../middlewares/authorization.middlewares.js";
import * as controllers from "./controllers.js";

const router = Router();
router.post("/", requireAuth, controllers.create);
export default router;
