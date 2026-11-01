import { z } from "zod";
import {
  GENDER_VALUES,
  PROFILE_CONFIG,
  PROFILE_LANGUAGE_VALUES,
} from "../../config/profile.config.js";
import { nameField, usernameField } from "../auth/schemas.js";

/** Letters and digits from any alphabet, plus a few marks that real interests use ("C++", "R&B", "Rock 'n' roll"). */
const LABEL_RE = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} .+#&'’/-]*$/u;
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F]/;

/** One interest or skill: spaces tidied, then checked. */
const label = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(PROFILE_CONFIG.label.min, `Each one needs at least ${PROFILE_CONFIG.label.min} characters`)
      .max(PROFILE_CONFIG.label.max, `Each one can be ${PROFILE_CONFIG.label.max} characters at most`)
      .regex(LABEL_RE, "Use letters, numbers and simple punctuation only"),
  );

/** Drops repeats ("music" and "Music" are the same), keeping the first spelling. */
function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const labels = (max: number, what: string) =>
  z.array(label).max(max, `Pick up to ${max} ${what}`).transform(unique);

const languages = z
  .array(z.string().refine((v) => PROFILE_LANGUAGE_VALUES.has(v), "That language isn’t supported"))
  .max(PROFILE_CONFIG.maxLanguages, `Pick up to ${PROFILE_CONFIG.maxLanguages} languages`)
  .transform((l) => [...new Set(l)]);

/** Empty or whitespace-only becomes null: "no bio". */
const bio = z
  .string()
  .trim()
  .max(PROFILE_CONFIG.bioMax, `Keep your bio to ${PROFILE_CONFIG.bioMax} characters`)
  .refine((v) => !CONTROL_RE.test(v), "Your bio contains characters that aren’t allowed")
  .nullable()
  .transform((v) => (v ? v : null));

const gender = z.enum(GENDER_VALUES, { error: "Choose one of the options" });

const interests = labels(PROFILE_CONFIG.maxInterests, "interests");
const skills = labels(PROFILE_CONFIG.maxSkills, "skills");

/** Answers to the onboarding questions. Everything except the bio is required. */
export const onboardingSchema = z.object({
  gender,
  spokenLanguages: languages.refine((l) => l.length > 0, "Pick at least one language"),
  interests: interests.refine((l) => l.length > 0, "Pick at least one interest"),
  skills: skills.refine((l) => l.length > 0, "Pick at least one skill"),
  bio: bio.optional(),
});

/** Editing later: send only what changed. Lists and the bio may be emptied. */
export const updateProfileSchema = z.object({
  name: nameField.optional(),
  username: usernameField.optional(),
  gender: gender.optional(),
  bio: bio.optional(),
  spokenLanguages: languages.optional(),
  interests: interests.optional(),
  skills: skills.optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
