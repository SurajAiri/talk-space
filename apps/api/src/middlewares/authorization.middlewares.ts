import type { NextFunction, Request, Response } from "express";
import { findAuthState } from "../features/user/services.js";
import { type UserType, verifyJWT } from "../services/jwt.service.js";

/** Attaches req.user if a validly signed Bearer token is present. Never rejects. */
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

/**
 * Rejects unauthenticated requests. A valid signature is not enough: the
 * account must still exist, be active, and the token must not have been
 * revoked. Role comes from the database too, so demotions apply immediately.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.sendResponse(401, null, "Unauthorized: please log in.");
  }
  const state = await findAuthState(req.user.id);
  if (!state || state.tokenVersion !== req.user.tv) {
    return res.sendResponse(401, null, "Your session has expired. Please log in again.");
  }
  if (state.status !== "active") {
    return res.sendResponse(403, null, `Account is ${state.status}`);
  }
  req.auth = { id: state.id, userType: state.userType };
  next();
}

/** Use after requireAuth. Rejects accounts that do not have the given role. */
export function restrictToUser(role: UserType = "user") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.sendResponse(401, null, "Unauthorized: please log in.");
    }
    if (req.auth.userType !== role) {
      return res.sendResponse(
        403,
        null,
        "Forbidden: You do not have permission to access this resource.",
      );
    }
    next();
  };
}
