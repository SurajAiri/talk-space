import { emoteById } from '../fx.ts'

/**
 * How the body moves during an emote. Pure maths (no canvas), so it is easy to test and the same for every viewer.
 * Arm angles are "raise": 0 hangs down, PI/2 is straight out to the side, PI is straight up, negative swings
 * in toward the body. null leaves that arm to the normal walking/idle animation.
 */
export interface Pose {
  /** px, negative = up */
  bob: number
  /** px, sideways */
  sway: number
  /** radians, whole body */
  tilt: number
  /** 0..1 of a full turn, or null for none */
  spin: number | null
  armL: number | null
  armR: number | null
  /** open mouth */
  laugh: boolean
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (v: number) => v * v * (3 - 2 * v)

/** `age` = ms since the emote started. null once it has finished (or for an id that is not an emote). */
export function emotePose(id: string, age: number): Pose | null {
  const def = emoteById(id)
  if (!def || age < 0 || age > def.ms) return null
  // ease in and out so it starts and ends from the normal standing pose instead of snapping
  const f = clamp01(Math.min(age / 180, (def.ms - age) / 240))
  const t = age
  const p: Pose = { bob: 0, sway: 0, tilt: 0, spin: null, armL: null, armR: null, laugh: false }

  switch (id) {
    case 'wave':
      p.armR = 2.5 + Math.sin(t * 0.02) * 0.45
      p.armL = 0.08
      p.bob = Math.sin(t * 0.004) * -0.8
      break
    case 'dance':
      p.bob = Math.abs(Math.sin(t * 0.012)) * -6
      p.sway = Math.sin(t * 0.006) * 2.6
      p.tilt = Math.sin(t * 0.006) * 0.09
      p.armL = 1.7 + Math.sin(t * 0.012) * 1.1
      p.armR = 1.7 + Math.sin(t * 0.012 + Math.PI) * 1.1
      break
    case 'cheer':
      p.armL = 2.85 + Math.sin(t * 0.02) * 0.16
      p.armR = 2.85 + Math.sin(t * 0.02 + 1.3) * 0.16
      p.bob = Math.abs(Math.sin(t * 0.01)) * -8
      break
    case 'clap': {
      const hands = -0.95 + (0.5 + 0.5 * Math.sin(t * 0.03)) * 0.42 // together... apart... together
      p.armL = hands
      p.armR = hands
      p.bob = Math.abs(Math.sin(t * 0.015)) * -1.5
      break
    }
    case 'jump':
      p.bob = Math.abs(Math.sin(t * 0.0053)) * -15
      p.armL = 0.7
      p.armR = 0.7
      break
    case 'spin':
      p.spin = smooth(clamp01(age / def.ms)) * 2 // two full turns
      p.armL = 1.25
      p.armR = 1.25
      p.bob = Math.sin(clamp01(age / def.ms) * Math.PI) * -7
      break
    case 'laugh':
      p.laugh = true
      p.bob = Math.sin(t * 0.045) * -1.8
      p.tilt = Math.sin(t * 0.022) * 0.07
      p.armL = -0.5
      p.armR = -0.5
      break
    default:
      return null
  }

  return {
    bob: p.bob * f,
    sway: p.sway * f,
    tilt: p.tilt * f,
    spin: p.spin,
    armL: p.armL === null ? null : p.armL * f,
    armR: p.armR === null ? null : p.armR * f,
    laugh: p.laugh && f > 0.2,
  }
}
