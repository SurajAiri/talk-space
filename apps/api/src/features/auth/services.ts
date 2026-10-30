import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema/index.js";
import { signJWT } from "../../services/jwt.service.js";
import { AppError } from "../../utils/errors.js";
import { revokeTokens } from "../user/services.js";
import type { RegisterInput } from "./schemas.js";

const BCRYPT_COST = 12;
/** Compared against when the email is unknown, so "no such account" takes as long as "wrong password". */
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);

const publicFields = {
  id: users.id,
  email: users.email,
  userType: users.userType,
  tokenVersion: users.tokenVersion,
};

type TokenUser = { id: string; email: string; userType: "user" | "admin"; tokenVersion: number };

function withToken(user: TokenUser) {
  return {
    user: { id: user.id, email: user.email, userType: user.userType },
    token: signJWT({ id: user.id, tv: user.tokenVersion }),
  };
}

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

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

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    const [created] = await db
      .insert(users)
      // emailVerified stays false: nobody has proven they own this address yet
      .values({ name, username, email, passwordHash })
      .returning(publicFields);
    if (!created) throw new AppError(500, "Failed to create user");
    return withToken(created);
  } catch (err) {
    // two sign-ups racing for the same email/username: the database is the referee
    if (isUniqueViolation(err)) throw new AppError(409, "Email or username already in use");
    throw err;
  }
}

export async function login(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // always run one bcrypt comparison, whether or not the account exists
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !valid) throw new AppError(401, "Invalid email or password");
  if (user.status !== "active") throw new AppError(403, `Account is ${user.status}`);

  return withToken({
    id: user.id,
    email: user.email,
    userType: user.userType,
    tokenVersion: user.tokenVersion,
  });
}

/** Swaps a still-valid token for a fresh one (the web app does this quietly). */
export async function refresh(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      userType: users.userType,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AppError(401, "Your session has expired. Please log in again.");
  return withToken(user);
}

/** "Log out everywhere": every token issued so far stops working. */
export async function logoutEverywhere(userId: string) {
  await revokeTokens(userId);
}

// Username for Google users: derived from the email, made unique.
async function generateUsername(email: string) {
  const base =
    email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 14) ||
    "user";
  for (let i = 0; i < 10; i++) {
    const candidate = `${base}${randomBytes(4).toString("hex").slice(0, 5)}`;
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}

/**
 * Existing account -> log in. No account yet -> create it, then log in.
 *
 * Only ever called with an address Google has verified. If an account with that
 * address was created with a password but never verified, whoever set that
 * password may not own the address (a pre-registration attack), so the person
 * who has now proven ownership takes the account over: the password is removed
 * and every older token stops working.
 */
export async function loginWithGoogle(profile: {
  email: string;
  name: string;
  emailVerified: boolean;
}) {
  if (!profile.emailVerified) {
    throw new AppError(403, "Your Google email address is not verified.");
  }
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
    if (!existing.emailVerified) {
      const [claimed] = await db
        .update(users)
        .set({
          emailVerified: true,
          passwordHash: null,
          tokenVersion: sql`${users.tokenVersion} + 1`,
        })
        .where(eq(users.id, existing.id))
        .returning(publicFields);
      if (!claimed) throw new AppError(500, "Failed to sign in");
      return withToken(claimed);
    }
    return withToken({
      id: existing.id,
      email: existing.email,
      userType: existing.userType,
      tokenVersion: existing.tokenVersion,
    });
  }

  try {
    const [created] = await db
      .insert(users)
      .values({
        name: profile.name || email.split("@")[0]!,
        username: await generateUsername(email),
        email,
        emailVerified: true,
      })
      .returning(publicFields);
    if (!created) throw new AppError(500, "Failed to create user");
    return withToken(created);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Could not create the account. Try again.");
    throw err;
  }
}

