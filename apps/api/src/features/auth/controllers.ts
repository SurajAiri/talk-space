import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { env } from "../../config/env.js";
import { googleAuth } from "../../lib/better-auth.js";
import { AppError } from "../../utils/errors.js";
import { loginSchema, registerSchema } from "./schemas.js";
import * as authService from "./services.js";

function parse<T>(schema: { safeParse: (d: unknown) => any }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? "Invalid input");
  }
  return result.data as T;
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

/**
 * Google redirects back here (via better-auth) after the OAuth handshake.
 * If the Google account already exists we log in, otherwise we create the
 * user first and then log in. Either way the web app gets our JWT.
 */
export async function googleComplete(req: Request, res: Response) {
  const fail = (msg: string) =>
    res.redirect(`${env.WEB_URL}/auth?error=${encodeURIComponent(msg)}`);

  const session = await googleAuth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) return fail("Google login failed");

  try {
    const { token } = await authService.loginWithGoogle({
      email: session.user.email,
      name: session.user.name,
    });
    res.redirect(`${env.WEB_URL}/auth/callback#token=${token}`);
  } catch (err) {
    fail(err instanceof AppError ? err.message : "Google login failed");
  }
}
