import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema/index.js";

export async function findUserById(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      userType: users.userType,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}
