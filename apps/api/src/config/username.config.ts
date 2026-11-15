/**
 * Who may call themselves what. The rules for PUBLIC sign-up and profile edits (features/auth/schemas.ts);
 * the staff-only path in features/admin/routes.ts deliberately skips the reserved-word and length rules,
 * which is how the team creates `admin`, short handles, or (later) paid / approved names.
 *
 * Matching has to catch dodges ("4dm1n", "ad_min", "adminnn", "staff2") without punishing real names
 * (the Scunthorpe problem), so there are two kinds of term:
 *   - SUBSTRING terms are long and distinctive: blocked anywhere in the name ("the_admin_guy").
 *   - WORD terms are short or double as ordinary words: blocked only when they are the whole name or a whole
 *     `_`-separated word ("mod", "dev_sam", "root"), so "model", "devon" and "cocktail" stay free.
 * Edit the lists below; nothing else needs to change.
 */

export const USERNAME_MIN = 6;
export const USERNAME_MAX = 20;

/** The one message people see, whichever rule they hit: it must not teach anyone which word to dodge. */
export const USERNAME_UNAVAILABLE = "That username isn’t available";

/** Impersonation: names that make someone look like the team. Matched anywhere, also across `_`. */
const RESERVED_SUBSTRINGS = [
  "admin",
  "developer",
  "staff",
  "moderator",
  "official",
  "talkspace",
  "helpdesk",
  "webmaster",
  "superuser",
  "customerservice",
  "customersupport",
  "trustandsafety",
];

/** Impersonation or confusing names that are also normal words: only as a whole name or a whole word. */
const RESERVED_WORDS = [
  "mod",
  "mods",
  "dev",
  "devs",
  "root",
  "system",
  "owner",
  "founder",
  "support",
  "help",
  "security",
  "api",
  "bot",
  "ceo",
  "cto",
  "null",
  "undefined",
  "anonymous",
  "everyone",
  "moderation",
];

/** Foul language and slurs that essentially never occur inside an innocent word. Matched anywhere in a word. */
const PROFANE_SUBSTRINGS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "whore",
  "slut",
  "bastard",
  "asshole",
  "dickhead",
  "bullshit",
  "cocksucker",
  "wanker",
  "twat",
  "nigger",
  "nigga",
  "faggot",
  "tranny",
  "chink",
  "porn",
  "pussy",
  "penis",
  "vagina",
  "dildo",
  "blowjob",
  "handjob",
  "cumshot",
  "orgasm",
  "pedophile",
  "molest",
  "hitler",
  "killyourself",
  // romanised Hindi / Nepali, the same bar: they do not occur inside ordinary words
  "madarchod",
  "behenchod",
  "bhenchod",
  "chutiya",
  "chutiye",
  "bhosdi",
  "bhosda",
  "haramkhor",
  "machikne",
];

/** Foul words that ARE inside innocent ones (cocktail, analyst, Janus, grape, Nazia, Essex): whole word only. */
const PROFANE_WORDS = [
  "ass",
  "arse",
  "dick",
  "cock",
  "cum",
  "tit",
  "tits",
  "boob",
  "boobs",
  "anal",
  "anus",
  "sex",
  "nude",
  "nudes",
  "milf",
  "horny",
  "rape",
  "rapist",
  "pedo",
  "fag",
  "retard",
  "nazi",
  "kkk",
  "kys",
  "gandu",
];

/** Harmless words that happen to contain a blocked term; removed before checking. */
const INNOCENT = ["badminton", "scunthorpe"];

const DIGIT_TO_LETTER_I: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" };
const DIGIT_TO_LETTER_L: Record<string, string> = { ...DIGIT_TO_LETTER_I, "1": "l" };

const leet = (s: string, map: Record<string, string>) => s.replace(/[013457]/g, (d) => map[d] ?? d);
const stripTrailingDigits = (s: string) => s.replace(/\d+$/, "");
const collapseRuns = (s: string) => s.replace(/(.)\1+/g, "$1");

/** Every spelling worth checking: as typed, without a numeric tail ("staff2"), digits read as letters ("4dm1n"), runs collapsed. */
function variants(username: string): string[] {
  let name = username;
  for (const w of INNOCENT) name = name.split(w).join("");
  const out = new Set<string>();
  for (const base of [name, stripTrailingDigits(name)]) {
    out.add(base);
    out.add(leet(base, DIGIT_TO_LETTER_I));
    out.add(leet(base, DIGIT_TO_LETTER_L));
  }
  for (const v of [...out]) out.add(collapseRuns(v));
  out.delete("");
  return [...out];
}

const includesAny = (haystack: string, terms: readonly string[]) => terms.some((t) => haystack.includes(t));

/** True if the name is free to take by the public. `username` is already lower case, a-z 0-9 and `_`. */
export function isUsernameAllowed(username: string): boolean {
  const reservedWord = new Set(RESERVED_WORDS);
  const profaneWord = new Set(PROFANE_WORDS);

  for (const v of variants(username)) {
    const words = v.split("_").filter(Boolean);
    const joined = words.join("");
    // impersonation: across underscores too ("ad_min"), and "staff" + anything
    if (includesAny(joined, RESERVED_SUBSTRINGS)) return false;
    // the whole name as one word ("r00t", "dev123") or any one `_` word of it ("dev_sam")
    if (reservedWord.has(joined) || words.some((w) => reservedWord.has(w) || reservedWord.has(stripTrailingDigits(w)))) return false;
    // foul language: inside each word only, so joining two innocent words can never form one
    for (const w of words) {
      if (includesAny(w, PROFANE_SUBSTRINGS)) return false;
      if (profaneWord.has(w) || profaneWord.has(stripTrailingDigits(w))) return false;
    }
  }
  return true;
}
