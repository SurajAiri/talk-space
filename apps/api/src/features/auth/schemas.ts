import { z } from "zod";
import { isUsernameAllowed, USERNAME_MAX, USERNAME_MIN, USERNAME_UNAVAILABLE } from "../../config/username.config.js";

const email = z.email("A valid email is required").trim().toLowerCase();

/** bcrypt silently ignores everything past 72 bytes, so refuse longer passwords instead of truncating them. */
export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((v) => Buffer.byteLength(v, "utf8") <= 72, "Password must be at most 72 bytes");

// Shared with profile editing (features/user/schemas.ts) so the rules can never drift apart.
export const nameField = z.string().trim().min(1, "Name is required").max(50);
export const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters`)
  .regex(/^[a-z0-9_]+$/, "Username can only use letters, numbers and underscores")
  .refine(isUsernameAllowed, USERNAME_UNAVAILABLE);

/**
 * What our own team may give an account: same alphabet, but 2-20 characters and no reserved-word or language
 * rules, so `admin`, `dev` or a short paid handle can be set. Only the admin routes use this one.
 */
export const staffUsernameField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{2,20}$/, "Username must be 2-20 characters: letters, numbers or underscores");

/**
 * Agreeing is part of creating an account: a missing or false value is refused, so the server
 * never holds an email sign-up that did not accept (the web form's checkbox is only a convenience).
 */
export const acceptPrivacyPolicy = z.literal(true, {
  error: "You must accept the Privacy Policy to create an account",
});

export const registerSchema = z.object({
  name: nameField,
  username: usernameField,
  email,
  password,
  acceptPrivacyPolicy,
});

export const loginSchema = z.object({
  email,
  // not validated against the policy: old accounts may predate it
  password: z.string().min(1, "Password is required").max(1024),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(1024),
  newPassword: password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
