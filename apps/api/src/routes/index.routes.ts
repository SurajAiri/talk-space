import { Router } from "express";
import adminRoutes from "../features/admin/routes.js";
import authRoutes from "../features/auth/routes.js";
import reportRoutes from "../features/reports/routes.js";
import roomRoutes from "../features/rooms/routes.js";
import userRoutes from "../features/user/routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.sendResponse(200, { status: "ok" });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/rooms", roomRoutes);
router.use("/reports", reportRoutes);
router.use("/admin", adminRoutes);

export default router;
