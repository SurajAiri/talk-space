import { betterAuth } from "better-auth";
import { env } from "../config/env.js";

// Used ONLY for the Google OAuth handshake. No database is configured, so
// better-auth runs stateless (its short-lived session lives in a signed cookie).
// Our own users table + JWT remain the real auth: see
// features/auth `googleComplete`, which turns this session into a JWT.
// With no Google credentials configured there are simply no providers, and the
// routes that use this are not mounted (see app.ts).
export const googleAuth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/v1/better-auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [...env.WEB_URLS, env.BETTER_AUTH_URL],
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60, strategy: "jwe" },
  },
  // advanced: { defaultCookieAttributes: { sameSite: "none", secure: true } },
  socialProviders: env.GOOGLE_ENABLED
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {},
});
