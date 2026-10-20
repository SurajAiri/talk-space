import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema/index.js";
import { signJWT } from "../../services/jwt.service.js";
import { AppError } from "../../utils/errors.js";
import type { RegisterInput } from "./schemas.js";

const publicFields = {
  id: users.id,
  email: users.email,
  userType: users.userType,
};

function withToken(user: { id: string; email: string; userType: "user" | "admin" }) {
  return { user, token: signJWT({ id: user.id, userType: user.userType }) };
}

export async function register(input: RegisterInput) {
  const { name, username, email, password } = input;

  const [emailTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (emailTaken) throw new AppError(409, "Email already in use");

  const [usernameTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (usernameTaken) throw new AppError(409, "Username already taken");

  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(users)
    .values({ name, username, email, passwordHash })
    .returning(publicFields);

  if (!created) throw new AppError(500, "Failed to create user");
  return withToken(created);
}

export async function login(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const valid =
    user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !valid) throw new AppError(401, "Invalid email or password");
  if (user.status !== "active") throw new AppError(403, `Account is ${user.status}`);

  return withToken({ id: user.id, email: user.email, userType: user.userType });
}

// Username for Google users: derived from the email, made unique.
async function generateUsername(email: string) {
  const base =
    email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 14) ||
    "user";
  for (let i = 0; i < 10; i++) {
    const candidate = `${base}${Math.random().toString(36).slice(2, 7)}`;
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}

/** Existing account -> log in. No account yet -> create it, then log in. */
export async function loginWithGoogle(profile: { email: string; name: string }) {
  const email = profile.email.trim().toLowerCase();

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    if (existing.status !== "active") {
      throw new AppError(403, `Account is ${existing.status}`);
    }
    return withToken({
      id: existing.id,
      email: existing.email,
      userType: existing.userType,
    });
  }

  const [created] = await db
    .insert(users)
    .values({
      name: profile.name || email.split("@")[0]!,
      username: await generateUsername(email),
      email,
    })
    .returning(publicFields);

  if (!created) throw new AppError(500, "Failed to create user");
  return withToken(created);
}
