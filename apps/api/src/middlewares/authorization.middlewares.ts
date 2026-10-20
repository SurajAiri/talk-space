import type { NextFunction, Request, Response } from "express";
import { type UserType, verifyJWT } from "../services/jwt.service.js";

/** Attaches req.user if a valid Bearer token is present. Never rejects. */
export function authorizeUser(req: Request, _res: Response, next: NextFunction) {
  req.user = null;

  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  if (scheme === "Bearer" && token) {
    try {
      req.user = verifyJWT(token);
    } catch {
      req.user = null;
    }
  }

  next();
}

/** Rejects unauthenticated requests. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.sendResponse(401, null, "Unauthorized: please log in.");
  }
  next();
}

/** Rejects requests whose user does not have the given role. */
export function restrictToUser(role: UserType = "user") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.sendResponse(401, null, "Unauthorized: please log in.");
    }
    if (req.user.userType !== role) {
      return res.sendResponse(
        403,
        null,
        "Forbidden: You do not have permission to access this resource.",
      );
    }
    next();
  };
}
