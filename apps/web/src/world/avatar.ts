import { appearanceFor, HAIR, SHIRT, SKIN } from './appearance.ts'

/**
 * A designed character, exactly as the API stores and validates it (apps/api/src/config/avatar.config.ts).
 * Colours are INDEXES into the palettes below and styles are names, so the server never judges a colour and a
 * peer can never inject one. scripts/avatar.test.ts fails if the two sides' lists drift apart.
 */
export interface AvatarConfig {
  skin: number
  hairStyle: string
  hairColor: number
  shirtStyle: string
  shirt: number
  pants: number
  accessory: string
}

/** What the renderer draws. A designed character resolves to one; so does the look generated from an id. */
export interface Look {
  skin: string
  hairColor: string
  hairStyle: string
  shirt: string
  shirtStyle: string
  pants: string
  accessory: string
}

// The first entries of each palette are the generated look's colours: someone who opens the designer starts from
// what they already look like, and nobody's colours shift.
export const SKIN_TONES: readonly string[] = [...SKIN, '#fde7d3', '#f1b79b', '#a9714b', '#3b2314']
export const HAIR_COLORS: readonly string[] = [...HAIR, '#7c3aed', '#22c55e', '#f97316', '#3b82f6', '#111111', '#fff3b0']
export const SHIRT_COLORS: readonly string[] = [...SHIRT, '#14b8a6', '#ef4444', '#84cc16', '#f8fafc', '#1f2937', '#fb923c']
export const PANTS_COLORS: readonly string[] = ['#1e293b', '#334155', '#0f766e', '#7c2d12', '#4c1d95', '#be123c', '#a16207', '#e2e8f0']

export interface Choice {
  id: string
  label: string
}

export const HAIR_STYLES: readonly Choice[] = [
  { id: 'spiky', label: 'Spiky' },
  { id: 'bob', label: 'Bob' },
  { id: 'long', label: 'Long' },
  { id: 'curly', label: 'Curly' },
  { id: 'bun', label: 'Bun' },
  { id: 'buzz', label: 'Buzz cut' },
  { id: 'mohawk', label: 'Mohawk' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'afro', label: 'Afro' },
  { id: 'pigtails', label: 'Pigtails' },
  { id: 'bald', label: 'Bald' },
]

export const SHIRT_STYLES: readonly Choice[] = [
  { id: 'tee', label: 'T-shirt' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'jacket', label: 'Jacket' },
]

export const ACCESSORIES: readonly Choice[] = [
  { id: 'none', label: 'None' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'sunglasses', label: 'Shades' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'sunhat', label: 'Sun hat' },
  { id: 'crown', label: 'Crown' },
  { id: 'catEars', label: 'Cat ears' },
  { id: 'headband', label: 'Headband' },
  { id: 'partyHat', label: 'Party hat' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'flower', label: 'Flower' },
  { id: 'bowtie', label: 'Bow tie' },
]

const ids = (list: readonly Choice[]) => list.map((c) => c.id)
const isInt = (v: unknown, count: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < count
const isOneOf = (v: unknown, list: readonly Choice[]): v is string => typeof v === 'string' && ids(list).includes(v)

/**
 * Anything that is not a complete, in-range character becomes null (= use the generated look). The server already
 * checks this; the client checks again because a bad value must never be able to break drawing.
 */
export function sanitizeAvatar(v: unknown): AvatarConfig | null {
  if (typeof v !== 'object' || v === null) return null
  const a = v as Record<string, unknown>
  if (
    !isInt(a.skin, SKIN_TONES.length) ||
    !isInt(a.hairColor, HAIR_COLORS.length) ||
    !isInt(a.shirt, SHIRT_COLORS.length) ||
    !isInt(a.pants, PANTS_COLORS.length) ||
    !isOneOf(a.hairStyle, HAIR_STYLES) ||
    !isOneOf(a.shirtStyle, SHIRT_STYLES) ||
    !isOneOf(a.accessory, ACCESSORIES)
  ) {
    return null
  }
  return { skin: a.skin, hairStyle: a.hairStyle, hairColor: a.hairColor, shirtStyle: a.shirtStyle, shirt: a.shirt, pants: a.pants, accessory: a.accessory }
}

export function resolveAvatar(a: AvatarConfig): Look {
  return {
    skin: SKIN_TONES[a.skin]!,
    hairColor: HAIR_COLORS[a.hairColor]!,
    hairStyle: a.hairStyle,
    shirt: SHIRT_COLORS[a.shirt]!,
    shirtStyle: a.shirtStyle,
    pants: PANTS_COLORS[a.pants]!,
    accessory: a.accessory,
  }
}

/** The look to draw for this person: their designed character if they have one, else the one generated from their id. */
export function lookFor(id: string, avatar?: unknown): Look {
  const designed = sanitizeAvatar(avatar)
  return designed ? resolveAvatar(designed) : appearanceFor(id)
}

/** The generated look, written as a character, so the designer opens on what someone already looks like. */
export function avatarFromId(id: string): AvatarConfig {
  const g = appearanceFor(id)
  return {
    skin: Math.max(0, SKIN_TONES.indexOf(g.skin)),
    hairStyle: g.hairStyle,
    hairColor: Math.max(0, HAIR_COLORS.indexOf(g.hairColor)),
    shirtStyle: g.shirtStyle,
    shirt: Math.max(0, SHIRT_COLORS.indexOf(g.shirt)),
    pants: Math.max(0, PANTS_COLORS.indexOf(g.pants)),
    accessory: g.accessory,
  }
}

/** A surprise, for the Randomise button. `rng` returns 0..1 (Math.random in the app, a fixed one in tests). */
export function randomAvatar(rng: () => number = Math.random): AvatarConfig {
  const n = (count: number) => Math.min(count - 1, Math.floor(rng() * count))
  const pick = (list: readonly Choice[]) => list[n(list.length)]!.id
  return {
    skin: n(SKIN_TONES.length),
    hairStyle: pick(HAIR_STYLES),
    hairColor: n(HAIR_COLORS.length),
    shirtStyle: pick(SHIRT_STYLES),
    shirt: n(SHIRT_COLORS.length),
    pants: n(PANTS_COLORS.length),
    accessory: pick(ACCESSORIES),
  }
}

export function sameAvatar(a: AvatarConfig | null, b: AvatarConfig | null): boolean {
  if (!a || !b) return a === b
  return (Object.keys(a) as (keyof AvatarConfig)[]).every((k) => a[k] === b[k])
}
