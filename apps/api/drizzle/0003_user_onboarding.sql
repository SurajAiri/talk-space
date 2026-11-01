CREATE TYPE "public"."gender" AS ENUM('female', 'male', 'non_binary', 'prefer_not_to_say');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" "gender";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp;--> statement-breakpoint
-- Accounts that already have some profile information are not asked again.
-- Everyone else (new sign-ups, and old accounts that never filled anything in) is onboarded on their next login.
UPDATE "users" SET "onboarded_at" = now()
WHERE cardinality("spoken_languages") > 0
   OR cardinality("interests") > 0
   OR cardinality("skills") > 0
   OR "bio" IS NOT NULL;
