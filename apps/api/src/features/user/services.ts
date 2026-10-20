import { eq } from "drizzle-orm";
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
