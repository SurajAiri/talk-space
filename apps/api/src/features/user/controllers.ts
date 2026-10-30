import type { Request, Response } from "express";
import { AppError } from "../../utils/errors.js";
import * as userService from "./services.js";

export async function getMe(req: Request, res: Response) {
  const user = await userService.findUserById(req.auth!.id);
  if (!user) throw new AppError(404, "User not found");
  res.sendResponse(200, user);
}
