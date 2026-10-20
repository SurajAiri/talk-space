import type { Request, Response } from "express";
import { AppError } from "../../utils/errors.js";
import * as authService from "./services.js";

function readCredentials(body: unknown) {
  const { email, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || !email.includes("@")) {
    throw new AppError(400, "A valid email is required");
  }
  if (typeof password !== "string" || password.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters");
  }
  return { email, password };
}

export async function register(req: Request, res: Response) {
  const { email, password } = readCredentials(req.body);
  const result = await authService.register(email, password);
  res.sendResponse(201, result, "Registered");
}

export async function login(req: Request, res: Response) {
  const { email, password } = readCredentials(req.body);
  const result = await authService.login(email, password);
  res.sendResponse(200, result, "Logged in");
}
