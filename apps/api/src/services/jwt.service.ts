import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export type UserType = "user" | "admin";

/**
 * What a token proves: who you are and which "generation" of tokens it belongs
 * to. Role and status are deliberately NOT trusted from the token; they are read
 * from the database on every protected request (see requireAuth).
 */
export interface AuthUser {
  id: string;
  /** token version; must equal users.token_version */
  tv: number;
}

export function signJWT(payload: AuthUser): string {
  return jwt.sign({ id: payload.id, tv: payload.tv }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyJWT(token: string): AuthUser {
  // pin the algorithm: never let the token choose how it is verified
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof decoded === "string" || typeof decoded.id !== "string" || typeof decoded.tv !== "number") {
    throw new Error("Invalid token payload");
  }
  return { id: decoded.id, tv: decoded.tv };
}
