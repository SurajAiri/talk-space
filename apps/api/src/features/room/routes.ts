import { Router } from "express";
import { requireAuth } from "../../middlewares/authorization.middlewares.js";
import * as controllers from "./controllers.js";

const router = Router();

router.use(requireAuth);

router.post("/", controllers.createRoom);
router.get("/", controllers.listRooms);
router.get("/:roomId", controllers.getRoom);
router.post("/:roomId/join", controllers.joinRoom);
router.post("/:roomId/leave", controllers.leaveRoom);
router.post("/:roomId/heartbeat", controllers.heartbeat);

export default router;
