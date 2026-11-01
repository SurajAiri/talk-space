ALTER TABLE "users" ADD COLUMN "privacy_policy_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "privacy_policy_version" text;
-- Deliberately no backfill: nobody has agreed to the Privacy Policy yet, so every existing account
-- is asked once on its next login. New email sign-ups record their agreement at registration;
-- Google sign-ups are asked on their first visit, before onboarding.
