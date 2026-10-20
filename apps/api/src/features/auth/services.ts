import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema/index.js";
import { signJWT } from "../../services/jwt.service.js";
import { AppError } from "../../utils/errors.js";

export async function register(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (existing) throw new AppError(409, "Email already in use");

  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(users)
    .values({ email: normalizedEmail, passwordHash })
    .returning({ id: users.id, email: users.email, userType: users.userType });

  if (!created) throw new AppError(500, "Failed to create user");
  return { user: created, token: signJWT({ id: created.id, userType: created.userType }) };
}

export async function login(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !valid) throw new AppError(401, "Invalid email or password");

  return {
    user: { id: user.id, email: user.email, userType: user.userType },
    token: signJWT({ id: user.id, userType: user.userType }),
  };
}
