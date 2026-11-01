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
export const genderEnum = pgEnum("gender", [
  "female",
  "male",
  "non_binary",
  "prefer_not_to_say",
]);
export type Gender = (typeof genderEnum.enumValues)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  // null for users who signed up with Google
  passwordHash: text("password_hash"),
  bio: text("bio"), // <= 200 chars
  // null until the person answers during onboarding
  gender: genderEnum("gender"),
  spokenLanguages: text("spoken_languages").array().notNull().default([]),
  interests: text("interests").array().notNull().default([]),
  skills: text("skills").array().notNull().default([]), // "good with"
  reputationScore: doublePrecision("reputation_score").notNull().default(0),
  strikes: integer("strikes").notNull().default(0),
  status: userStatusEnum("status").notNull().default("active"),
  userType: userTypeEnum("user_type").notNull().default("user"),
  // Set when the person finishes the onboarding questions. null = the web app sends them there
  // after login, so new accounts (and old ones that never filled in a profile) are asked once.
  onboardedAt: timestamp("onboarded_at"),
  // true once the address is proven to belong to this person (Google says so).
  // Password sign-ups start unverified: nobody has checked the address yet.
  emailVerified: boolean("email_verified").notNull().default(false),
  // Bumped to invalidate every token issued before (ban, password reset, "log out everywhere").
  tokenVersion: integer("token_version").notNull().default(0),
  // When the person agreed to the Privacy Policy, and which version they agreed to
  // (config/legal.config.ts). null = never accepted: Google sign-ups are asked on their first visit,
  // and accounts that predate the policy are asked once on their next login.
  // timestamptz, unlike the columns above: this is a record of a moment, so it must not depend on
  // the time zone the database session happens to run in.
  privacyPolicyAcceptedAt: timestamp("privacy_policy_accepted_at", { withTimezone: true }),
  privacyPolicyVersion: text("privacy_policy_version"),
  createdAt: timestamp("created_at").notNull().defaultNow(), // joined date
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
