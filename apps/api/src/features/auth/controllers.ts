import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { env } from "../../config/env.js";
import { googleAuth } from "../../lib/better-auth.js";
import { AppError } from "../../utils/errors.js";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from "./schemas.js";
import * as authService from "./services.js";

function parse<T>(
  schema: { safeParse: (d: unknown) => any },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? "Invalid input");
  }
  return result.data as T;
}

/** Tells the web app which sign-in buttons to show. */
export function providers(_req: Request, res: Response) {
  res.sendResponse(200, { google: env.GOOGLE_ENABLED });
}

export async function register(req: Request, res: Response) {
  const input = parse<ReturnType<typeof registerSchema.parse>>(
    registerSchema,
    req.body,
  );
  const result = await authService.register(input);
  res.sendResponse(201, result, "Registered");
}

export async function login(req: Request, res: Response) {
  const { email, password } = parse<ReturnType<typeof loginSchema.parse>>(
    loginSchema,
    req.body,
  );
  const result = await authService.login(email, password);
  res.sendResponse(200, result, "Logged in");
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refresh(req.auth!.id);
  res.sendResponse(200, result, "Refreshed");
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = parse<
    ReturnType<typeof changePasswordSchema.parse>
  >(changePasswordSchema, req.body);
  const result = await authService.changePassword(
    req.auth!.id,
    currentPassword,
    newPassword,
  );
  res.sendResponse(200, { token: result.token }, "Password changed");
}

export async function logoutEverywhere(req: Request, res: Response) {
  await authService.logoutEverywhere(req.auth!.id);
  res.sendResponse(200, null, "Logged out everywhere");
}

/**
 * Google redirects back here (via better-auth) after the OAuth handshake.
 * If the Google account already exists we log in, otherwise we create the
 * user first and then log in. Either way the web app gets our JWT.
 */
export async function googleComplete(req: Request, res: Response) {
  const fail = (msg: string) =>
    res.redirect(`${env.WEB_URL}/auth?error=${encodeURIComponent(msg)}`);

  if (!env.GOOGLE_ENABLED) return fail("Google login is not enabled");

  const session = await googleAuth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    console.warn("google/complete: NO SESSION COOKIE ARRIVED");
    return fail("Google login failed");
  }

  try {
    const { token } = await authService.loginWithGoogle({
      email: session.user.email,
      name: session.user.name,
      emailVerified: session.user.emailVerified === true,
    });
    res.redirect(`${env.WEB_URL}/auth/callback#token=${token}`);
  } catch (err) {
    console.error("google/complete failed:", err);
    fail(err instanceof AppError ? err.message : "Google login failed");
  }
}
