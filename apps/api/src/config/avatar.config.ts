/**
 * What a person may pick when they design their character. The web app (apps/web/src/world/avatar.ts) draws
 * these: colours are an INDEX into its palettes and styles are NAMES, so this file only has to know how many
 * there are and which names exist. The server never stores a colour, which means it also never has to
 * judge one. A web test (scripts/avatar.test.ts) reads this file and fails if the two lists drift apart.
 *
 * `null` (nothing saved) means "use the look generated from the account id", which is what everybody has
 * until they choose.
 */
export const AVATAR_CONFIG = {
  skin: 10,
  hairColor: 14,
  shirt: 14,
  pants: 8,
  hairStyles: ["spiky", "bob", "long", "curly", "bun", "buzz", "mohawk", "ponytail", "afro", "pigtails", "bald"],
  shirtStyles: ["tee", "hoodie", "stripes", "jacket"],
  accessories: [
    "none",
    "glasses",
    "sunglasses",
    "headphones",
    "sunhat",
    "crown",
    "catEars",
    "headband",
    "partyHat",
    "beanie",
    "flower",
    "bowtie",
  ],
} as const;

export interface Avatar {
  skin: number;
  hairStyle: string;
  hairColor: number;
  shirtStyle: string;
  shirt: number;
  pants: number;
  accessory: string;
}
