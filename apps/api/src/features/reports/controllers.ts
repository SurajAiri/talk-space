import type { Request, Response } from "express";
import { AppError } from "../../utils/errors.js";
import { createReportSchema } from "./schemas.js";
import * as reportService from "./services.js";

export async function create(req: Request, res: Response) {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  const { id } = await reportService.createReport(req.auth!.id, parsed.data);
  res.sendResponse(201, { id }, "Report received. Thank you.");
}
