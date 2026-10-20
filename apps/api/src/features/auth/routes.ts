import { Router } from "express";
import * as controllers from "./controllers.js";

const router = Router();

router.post("/register", controllers.register);
router.post("/login", controllers.login);
router.get("/google/complete", controllers.googleComplete);

export default router;
