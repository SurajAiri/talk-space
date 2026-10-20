import type { AuthUser } from "../services/jwt.service.js";

declare global {
  namespace Express {
    interface Request {
      user: AuthUser | null;
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
