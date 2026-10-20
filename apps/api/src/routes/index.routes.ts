import { Router } from "express";
import authRoutes from "../features/auth/routes.js";
import roomRoutes from "../features/rooms/routes.js";
import userRoutes from "../features/user/routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.sendResponse(200, { status: "ok" });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/rooms", roomRoutes);

export default router;
