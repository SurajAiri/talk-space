import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema/index.js";
import { AppError, isUniqueViolation } from "../../utils/errors.js";
import type { OnboardingInput, UpdateProfileInput } from "./schemas.js";

/** What the person themselves may see about their own account (never the hash or the token version). */
const ownProfile = {
  id: users.id,
  name: users.name,
  username: users.username,
  email: users.email,
  bio: users.bio,
  gender: users.gender,
  spokenLanguages: users.spokenLanguages,
  interests: users.interests,
  skills: users.skills,
  reputationScore: users.reputationScore,
  strikes: users.strikes,
  status: users.status,
  userType: users.userType,
  onboardedAt: users.onboardedAt,
  // Google accounts have no password; the web app only offers "change password" when there is one.
  hasPassword: sql<boolean>`${users.passwordHash} is not null`,
  createdAt: users.createdAt,
};

export async function findUserById(id: string) {
  const [user] = await db.select(ownProfile).from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

/** Changes only the fields that were sent. */
export async function updateProfile(id: string, patch: UpdateProfileInput) {
  try {
    const [user] = await db.update(users).set(patch).where(eq(users.id, id)).returning(ownProfile);
    if (!user) throw new AppError(404, "User not found");
    return user;
  } catch (err) {
    // username is the only unique column this can touch; the database is the referee for races
    if (isUniqueViolation(err)) throw new AppError(409, "Username already taken");
    throw err;
  }
}

/**
 * Saves the onboarding answers and marks the account as onboarded. Safe to repeat (a double click,
 * two tabs): the answers are overwritten and the original completion time is kept.
 */
export async function completeOnboarding(id: string, input: OnboardingInput) {
  const [user] = await db
    .update(users)
    .set({
      gender: input.gender,
      spokenLanguages: input.spokenLanguages,
      interests: input.interests,
      skills: input.skills,
      bio: input.bio ?? null,
      onboardedAt: sql`coalesce(${users.onboardedAt}, now())`,
    })
    .where(eq(users.id, id))
    .returning(ownProfile);
  if (!user) throw new AppError(404, "User not found");
  return user;
}

/** The facts a token is checked against. Always read fresh: this is how bans and demotions take effect. */
export async function findAuthState(id: string) {
  const [row] = await db
    .select({
      id: users.id,
      status: users.status,
      userType: users.userType,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

/** Invalidates every token issued so far for this user. */
export async function revokeTokens(id: string) {
  await db
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, id));
}
