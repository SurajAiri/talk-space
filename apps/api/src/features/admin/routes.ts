import { Router } from "express";
import { requireAuth, restrictToUser } from "../../middlewares/authorization.middlewares.js";
import { listReportsSchema, resolveReportSchema } from "../reports/schemas.js";
import * as reportService from "../reports/services.js";
import { AppError } from "../../utils/errors.js";
import { staffUsernameField } from "../auth/schemas.js";
import * as userService from "../user/services.js";
import { z } from "zod";

const router = Router();
router.use(requireAuth, restrictToUser("admin"));

/** GET /admin/reports?status=open: the moderation queue. */
router.get("/reports", async (req, res) => {
  const q = listReportsSchema.safeParse(req.query);
  if (!q.success) throw new AppError(400, q.error.issues[0]?.message ?? "Invalid input");
  res.sendResponse(200, await reportService.listReports(q.data.status, q.data.limit));
});

/** POST /admin/reports/:id/resolve  { action: dismiss | strike | suspend | ban } */
router.post("/reports/:id/resolve", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const body = resolveReportSchema.safeParse(req.body);
  if (!id.success || !body.success) throw new AppError(400, "Invalid request");
  await reportService.resolveReport(id.data, req.auth!.id, body.data.action);
  res.sendResponse(200, null, "Report handled");
});

/**
 * PATCH /admin/users/:id/username  { username }
 * Sets any username (2-20 of a-z 0-9 _), including the ones public sign-up refuses: `admin`, `developer`, short
 * handles, a paid or staff-approved name. Admin accounts only (the router guard above).
 */
router.patch("/users/:id/username", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const body = z.object({ username: staffUsernameField }).safeParse(req.body);
  if (!id.success) throw new AppError(400, "Invalid request");
  if (!body.success) throw new AppError(400, body.error.issues[0]?.message ?? "Invalid input");
  res.sendResponse(200, await userService.setUsernameAsStaff(id.data, body.data.username), "Username updated");
});

export default router;
