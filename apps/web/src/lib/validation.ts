/**
 * Client-side checks that mirror the API's rules (apps/api/src/features/auth/schemas.ts and
 * rooms/schemas.ts) so people hear about a typo as they type, not after a round trip.
 * The server stays the authority: nothing here is a security boundary.
 */

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const PASSWORD_MIN = 8
/** bcrypt ignores everything past 72 bytes, so the server refuses longer passwords. */
export const PASSWORD_MAX_BYTES = 72

export function validateName(v: string): string | null {
  const t = v.trim()
  if (!t) return 'Enter your name'
  if (t.length > 50) return 'Keep it to 50 characters'
  return null
}

/** What gets stored: lower case, only letters, digits and underscores. Used as the person types. */
export function normalizeUsername(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
}

export function validateUsername(v: string): string | null {
  if (!v) return 'Pick a username'
  if (v.length < 3) return 'At least 3 characters'
  if (!USERNAME_RE.test(v)) return 'Letters, numbers and underscores only'
  return null
}

export function validateEmail(v: string): string | null {
  const t = v.trim()
  if (!t) return 'Enter your email'
  if (!EMAIL_RE.test(t)) return 'That doesn’t look like an email address'
  return null
}

export function validateNewPassword(v: string): string | null {
  if (!v) return 'Choose a password'
  if (v.length < PASSWORD_MIN) return `At least ${PASSWORD_MIN} characters`
  if (new TextEncoder().encode(v).length > PASSWORD_MAX_BYTES) return 'That’s too long (72 bytes at most)'
  return null
}

export function validateExistingPassword(v: string): string | null {
  return v ? null : 'Enter your password'
}

export interface Strength {
  /** 0 = too short to use, 1..4 = weak .. strong */
  score: 0 | 1 | 2 | 3 | 4
  label: string
}

const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const

/** Deliberately simple: length first, then variety. It guides; the only hard rule is the minimum length. */
export function passwordStrength(pw: string): Strength {
  if (pw.length < PASSWORD_MIN) return { score: 0, label: STRENGTH_LABELS[0] }
  let points = 1
  if (pw.length >= 12) points++
  if (pw.length >= 16) points++ // length is what really stops guessing: a long passphrase is strong
  if ((/[a-z]/.test(pw) && /[A-Z]/.test(pw)) || (/\d/.test(pw) && /[a-zA-Z]/.test(pw))) points++
  if (/[^a-zA-Z0-9]/.test(pw)) points++
  // a few very common choices stay "weak" however they are padded
  if (/^(password|12345678|qwertyui|letmein|iloveyou)/i.test(pw)) points = 1
  const score = Math.min(4, points) as 1 | 2 | 3 | 4
  return { score, label: STRENGTH_LABELS[score] }
}

// ---- rooms ----

/** `Rust Lang` -> `rust-lang`, `#Go` -> `go`: what the API accepts (a-z 0-9 + # . -). */
export function normalizeTag(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9+#.-]/g, '')
}

export function validateTag(tag: string, min: number, max: number): string | null {
  if (tag.length < min) return `Tags need at least ${min} characters`
  if (tag.length > max) return `Tags are ${max} characters at most`
  return null
}

// ---- profile ----

/** Mirrors the server's rule for one interest or skill (apps/api/src/features/user/schemas.ts). */
const LABEL_RE = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} .+#&'’/-]*$/u

/** `  rock   climbing ` -> `rock climbing`: what gets stored. */
export function normalizeLabel(v: string): string {
  return v.trim().replace(/\s+/g, ' ')
}

export function validateLabel(label: string, min: number, max: number): string | null {
  if (label.length < min) return `At least ${min} characters`
  if (label.length > max) return `${max} characters at most`
  if (!LABEL_RE.test(label)) return 'Letters, numbers and simple punctuation only'
  return null
}

/** True when two lists hold the same items in the same order. */
export function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function validateBio(v: string, max: number): string | null {
  return v.trim().length > max ? `Keep it to ${max} characters` : null
}

export function validateConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Type the new password again'
  return password === confirmation ? null : 'The two passwords don’t match'
}
