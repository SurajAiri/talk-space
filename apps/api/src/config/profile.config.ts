import type { Gender } from "../db/schema/users.js";
import { LANGUAGES } from "./rooms.config.js";

/**
 * Central profile / onboarding configuration. The web app reads it from
 * GET /api/v1/users/options, so changing a limit or a suggestion here is the only edit needed.
 */
export const PROFILE_CONFIG = {
  bioMax: 200,
  /** Most items a person can pick in each list. */
  maxLanguages: 8,
  maxInterests: 10,
  maxSkills: 10,
  /** Length of one interest / skill (they are free text, with suggestions to start from). */
  label: { min: 2, max: 30 },
} as const;

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "female", label: "Woman" },
  { value: "male", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

/**
 * Languages people can say they speak: every room language first (so a person's profile can match
 * the rooms they will look for), then more, alphabetically. Values are language codes.
 */
const MORE_LANGUAGES = [
  { value: "bho", label: "Bhojpuri" },
  { value: "el", label: "Greek" },
  { value: "fa", label: "Persian" },
  { value: "fil", label: "Filipino" },
  { value: "gu", label: "Gujarati" },
  { value: "he", label: "Hebrew" },
  { value: "kn", label: "Kannada" },
  { value: "mai", label: "Maithili" },
  { value: "ml", label: "Malayalam" },
  { value: "mr", label: "Marathi" },
  { value: "ms", label: "Malay" },
  { value: "new", label: "Newar" },
  { value: "nl", label: "Dutch" },
  { value: "pa", label: "Punjabi" },
  { value: "pl", label: "Polish" },
  { value: "si", label: "Sinhala" },
  { value: "sv", label: "Swedish" },
  { value: "sw", label: "Swahili" },
  { value: "te", label: "Telugu" },
  { value: "th", label: "Thai" },
  { value: "uk", label: "Ukrainian" },
  { value: "vi", label: "Vietnamese" },
] as const;

export const PROFILE_LANGUAGES: { value: string; label: string }[] = [
  ...LANGUAGES,
  ...MORE_LANGUAGES,
];

export const GENDER_VALUES = GENDERS.map((g) => g.value) as [Gender, ...Gender[]];
export const PROFILE_LANGUAGE_VALUES = new Set<string>(PROFILE_LANGUAGES.map((l) => l.value));

/** Starting points only: people can type their own. */
export const INTEREST_SUGGESTIONS = [
  "Music",
  "Movies",
  "Books",
  "Gaming",
  "Travel",
  "Cooking",
  "Photography",
  "Fitness",
  "Football",
  "Cricket",
  "Anime",
  "Art",
  "Technology",
  "Startups",
  "Science",
  "History",
  "Writing",
  "Hiking",
  "Podcasts",
  "Languages",
] as const;

export const SKILL_SUGGESTIONS = [
  "Listening",
  "Storytelling",
  "Public speaking",
  "Debating",
  "Teaching",
  "Mentoring",
  "Writing",
  "Programming",
  "Design",
  "Singing",
  "Math",
  "Making people laugh",
  "Giving advice",
  "Explaining things",
  "Negotiation",
  "Languages",
] as const;

/** What the web app needs to render the onboarding and profile forms. */
export function publicProfileOptions() {
  return {
    bioMax: PROFILE_CONFIG.bioMax,
    maxLanguages: PROFILE_CONFIG.maxLanguages,
    maxInterests: PROFILE_CONFIG.maxInterests,
    maxSkills: PROFILE_CONFIG.maxSkills,
    label: PROFILE_CONFIG.label,
    genders: GENDERS,
    languages: PROFILE_LANGUAGES,
    interestSuggestions: INTEREST_SUGGESTIONS,
    skillSuggestions: SKILL_SUGGESTIONS,
  };
}
