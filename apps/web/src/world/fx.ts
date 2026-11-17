/**
 * Everything a person can do to show how they feel, as fixed lists. Peers only ever send an ID from these
 * lists (webrtc/types.ts checks it), never text or an image, so a modified client cannot put anything on
 * anyone's screen that is not in here. Pure data: the UI, the network layer and the renderer all read it.
 */

/** An animation your character plays. Walking cancels it. */
export interface EmoteDef {
  id: string
  label: string
  emoji: string
  /** how long it plays, ms */
  ms: number
}

export const EMOTES: readonly EmoteDef[] = [
  { id: 'wave', label: 'Wave', emoji: '👋', ms: 2600 },
  { id: 'dance', label: 'Dance', emoji: '💃', ms: 6000 },
  { id: 'cheer', label: 'Cheer', emoji: '🙌', ms: 2800 },
  { id: 'clap', label: 'Clap', emoji: '👏', ms: 2600 },
  { id: 'jump', label: 'Jump', emoji: '🦘', ms: 1800 },
  { id: 'spin', label: 'Spin', emoji: '🌀', ms: 1500 },
  { id: 'laugh', label: 'Laugh', emoji: '😂', ms: 2600 },
]

export type ReactionStyle = 'pop' | 'shake' | 'rainbow' | 'wave' | 'glow' | 'bounce'

/** Something that floats above your head: an emoji burst, or a word in big animated letters. */
export interface ReactionDef {
  id: string
  kind: 'emoji' | 'text'
  /** the emoji, or the word */
  text: string
  /** what a screen reader / tooltip says */
  label: string
  style: ReactionStyle
  /** letter colour (text only; "rainbow" ignores it) */
  color: string
}

const emoji = (id: string, text: string, label: string): ReactionDef => ({ id, kind: 'emoji', text, label, style: 'pop', color: '#ffffff' })
const word = (id: string, text: string, style: ReactionStyle, color: string): ReactionDef => ({ id, kind: 'text', text, label: text, style, color })

export const REACTIONS: readonly ReactionDef[] = [
  emoji('like', '👍', 'Thumbs up'),
  emoji('love', '❤️', 'Love'),
  emoji('haha', '😂', 'Laughing'),
  emoji('wow', '😮', 'Surprised'),
  emoji('clap', '👏', 'Applause'),
  emoji('party', '🎉', 'Celebrate'),
  emoji('fire', '🔥', 'Fire'),
  emoji('cry', '😢', 'Sad'),
  emoji('pray', '🙏', 'Thank you'),
  emoji('think', '🤔', 'Thinking'),
  emoji('hundred', '💯', 'Hundred'),
  emoji('eyes', '😍', 'Heart eyes'),
  word('t-wow', 'WOW!', 'pop', '#facc15'),
  word('t-lol', 'LOL', 'wave', '#34d399'),
  word('t-gg', 'GG', 'bounce', '#60a5fa'),
  word('t-hype', 'HYPE!', 'shake', '#fb923c'),
  word('t-yes', 'YES!', 'glow', '#a3e635'),
  word('t-omg', 'OMG', 'rainbow', '#ffffff'),
  word('t-nice', 'NICE!', 'pop', '#22d3ee'),
  word('t-thanks', 'THANKS!', 'wave', '#f472b6'),
  word('t-love', 'LOVE', 'glow', '#fb7185'),
  word('t-hello', 'HELLO!', 'wave', '#fde047'),
  word('t-brb', 'BRB', 'bounce', '#c4b5fd'),
  word('t-oops', 'OOPS', 'shake', '#fca5a5'),
]

/** How long a reaction stays up, ms. */
export const REACTION_MS = { emoji: 2800, text: 3400 } as const

const emoteIds = new Map(EMOTES.map((e) => [e.id, e]))
const reactionIds = new Map(REACTIONS.map((r) => [r.id, r]))

/** The definition for an id from the network, or undefined for anything that is not on the list. */
export const emoteById = (id: unknown): EmoteDef | undefined => (typeof id === 'string' ? emoteIds.get(id) : undefined)
export const reactionById = (id: unknown): ReactionDef | undefined => (typeof id === 'string' ? reactionIds.get(id) : undefined)
