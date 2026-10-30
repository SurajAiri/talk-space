import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema/index.js";

export async function findUserById(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      bio: users.bio,
      spokenLanguages: users.spokenLanguages,
      interests: users.interests,
      skills: users.skills,
      reputationScore: users.reputationScore,
      strikes: users.strikes,
      status: users.status,
      userType: users.userType,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
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
