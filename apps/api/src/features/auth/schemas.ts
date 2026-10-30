import { z } from "zod";

const email = z.email("A valid email is required").trim().toLowerCase();

/** bcrypt silently ignores everything past 72 bytes, so refuse longer passwords instead of truncating them. */
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((v) => Buffer.byteLength(v, "utf8") <= 72, "Password must be at most 72 bytes");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_]{3,20}$/,
      "Username must be 3-20 characters: letters, numbers or underscores",
    ),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  // not validated against the policy: old accounts may predate it
  password: z.string().min(1, "Password is required").max(1024),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
