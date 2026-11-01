import { eq, sql } from "drizzle-orm";
import { PRIVACY_POLICY_VERSION } from "../../config/legal.config.js";
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
  privacyPolicyAcceptedAt: users.privacyPolicyAcceptedAt,
  privacyPolicyVersion: users.privacyPolicyVersion,
  // True until the person has accepted the CURRENT version of the Privacy Policy. Worked out here,
  // next to the version itself, so the web app never has to guess which version is current.
  needsPrivacyConsent: sql<boolean>`(${users.privacyPolicyAcceptedAt} is null or ${users.privacyPolicyVersion} is distinct from ${PRIVACY_POLICY_VERSION}::text)`,
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
  // Onboarding is where Google sign-ups end up first, so this is the last place to make sure the
  // Privacy Policy has been accepted even if the web app's own gate was skipped.
  const [current] = await db
    .select({ needsConsent: ownProfile.needsPrivacyConsent })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!current) throw new AppError(404, "User not found");
  if (current.needsConsent) {
    throw new AppError(403, "Please accept the Privacy Policy to continue");
  }

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

/**
 * Records that the person accepted the current Privacy Policy. Safe to repeat (a double click, two
 * tabs): if they already accepted this exact version the original time is kept, so the stored
 * moment is always the first time they agreed to this text. A newer version gets a new time.
 */
export async function acceptPrivacyPolicy(id: string) {
  const [user] = await db
    .update(users)
    .set({
      privacyPolicyAcceptedAt: sql`case
        when ${users.privacyPolicyAcceptedAt} is not null
          and ${users.privacyPolicyVersion} is not distinct from ${PRIVACY_POLICY_VERSION}::text
        then ${users.privacyPolicyAcceptedAt}
        else now()
      end`,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
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
