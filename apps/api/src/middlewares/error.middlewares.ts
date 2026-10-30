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

  // Client mistakes raised by Express itself (body too large, malformed JSON...)
  // are the client's fault: say so, instead of logging a stack trace and answering 500.
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    const message =
      status === 413 ? "Request body is too large" : status === 400 ? "Malformed request" : "Bad request";
    return res.sendResponse(status, null, message);
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
