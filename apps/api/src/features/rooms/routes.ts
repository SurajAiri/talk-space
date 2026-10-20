import { Router } from "express";
import { requireAuth } from "../../middlewares/authorization.middlewares.js";
import * as controllers from "./controllers.js";

const router = Router();

router.use(requireAuth);
router.get("/config", controllers.getConfig);
router.get("/", controllers.list);
router.post("/", controllers.create);
router.get("/:roomId", controllers.preview);

export default router;
