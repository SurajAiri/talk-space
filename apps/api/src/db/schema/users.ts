import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userTypeEnum = pgEnum("user_type", ["user", "admin"]);
export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "banned",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  // null for users who signed up with Google
  passwordHash: text("password_hash"),
  bio: text("bio"), // <= 200 chars
  spokenLanguages: text("spoken_languages").array().notNull().default([]),
  interests: text("interests").array().notNull().default([]),
  skills: text("skills").array().notNull().default([]), // "good with"
  reputationScore: doublePrecision("reputation_score").notNull().default(0),
  strikes: integer("strikes").notNull().default(0),
  status: userStatusEnum("status").notNull().default("active"),
  userType: userTypeEnum("user_type").notNull().default("user"),
  // true once the address is proven to belong to this person (Google says so).
  // Password sign-ups start unverified: nobody has checked the address yet.
  emailVerified: boolean("email_verified").notNull().default(false),
  // Bumped to invalidate every token issued before (ban, password reset, "log out everywhere").
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(), // joined date
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
