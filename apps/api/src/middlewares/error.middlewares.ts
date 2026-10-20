import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

export function notFoundHandler(req: Request, res: Response) {
  res.sendResponse(404, null, `Route not found: ${req.method} ${req.originalUrl}`);
}

// Express 5 forwards rejected promises from async handlers here automatically.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.sendResponse(err.statusCode, null, err.message);
  }

  console.error(err);
  const message =
    env.NODE_ENV === "production"
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Internal server error";
  return res.sendResponse(500, null, message);
}
