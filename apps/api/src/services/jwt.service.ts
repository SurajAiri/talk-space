import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export type UserType = "user" | "admin";

export interface AuthUser {
  id: string;
  userType: UserType;
}

export function signJWT(payload: AuthUser): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyJWT(token: string): AuthUser {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return { id: decoded.id as string, userType: decoded.userType as UserType };
}
