import type { AuthUser, UserType } from "../services/jwt.service.js";

declare global {
  namespace Express {
    interface Request {
      /** Signature-checked token contents. Set by authorizeUser; NOT yet checked against the database. */
      user: AuthUser | null;
      /** Set by requireAuth after the database confirmed the account is active and the token is current. */
      auth?: { id: string; userType: UserType };
    }
    interface Response {
      sendResponse: (
        statusCode: number,
        data?: unknown,
        message?: string | null,
        meta?: unknown,
      ) => Response;
    }
  }
}

export {};
