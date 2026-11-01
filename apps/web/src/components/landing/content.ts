import type { ActorSpec, Camera } from './WorldView'

/** Greetings, one per supported language (kept in step with LANGUAGES in the API's rooms.config). */
export const HELLOS = [
  'Hello', 'नमस्ते', 'नमस्कार', 'হ্যালো', 'سلام', 'வணக்கம்', 'Hola', 'Bonjour', 'Hallo',
  'Olá', 'Привет', 'مرحبا', '你好', 'こんにちは', '안녕', 'Halo', 'Merhaba', 'Ciao',
]

/** The hero room: Courtyard Commons, with a few people who wander and chat. */
export const HERO_MAP = 'commons'
export const HERO_CAMERA: Camera = { col: 22, row: 16, across: 26 }
export const HERO_ACTORS: ActorSpec[] = [
  { id: 'you', name: 'You', col: 22, row: 16, you: true },
  { id: 'priya', name: 'Priya', col: 25, row: 14, say: 'नमस्ते! Join us?', wander: 3 },
  { id: 'diego', name: 'Diego', col: 19, row: 19, say: '¿Practicamos juntos?', wander: 3 },
  { id: 'hana', name: 'Hana', col: 27, row: 20, wander: 2 },
  { id: 'leo', name: 'Leo', col: 32, row: 20, wander: 1 },
]

export interface Scene {
  title: string
  text: string
  camera: Camera
  actors: ActorSpec[]
  activeZone?: string
}

const YOU: ActorSpec = { id: 'you', name: 'You', col: 22, row: 16, you: true }

/** The scroll story. Same three people every time; they walk to new spots when the step changes. */
export const SCENES: Scene[] = [
  {
    title: 'Close means clear.',
    text: 'Inside two steps, someone sounds like they’re standing right next to you. The solid ring is that range, and the numbers are the real volume.',
    camera: { col: 22.5, row: 16.5, across: 16 },
    actors: [
      YOU,
      { id: 'priya', name: 'Priya', col: 24, row: 16, say: 'Hola, ¿practicamos?' },
      { id: 'diego', name: 'Diego', col: 26, row: 19 },
    ],
  },
  {
    title: 'Far means faded.',
    text: 'Past that the sound drops away quickly, and by seven steps it’s gone. Nobody to mute and nobody talking over anyone. If you’re not near, you’re simply out of earshot.',
    camera: { col: 22.5, row: 18, across: 20 },
    actors: [
      YOU,
      { id: 'priya', name: 'Priya', col: 25, row: 20, say: 'See you in a bit!' },
      { id: 'diego', name: 'Diego', col: 22, row: 26 },
    ],
  },
  {
    title: 'Zones mean privacy.',
    text: 'Rooms have corners: a café, a library, a campfire deck. Inside a zone everyone hears each other at full volume, wherever they stand. Step through the door and the rest of the room goes quiet.',
    camera: { col: 11, row: 8, across: 22 },
    activeZone: 'cafe',
    actors: [
      { id: 'you', name: 'You', col: 13, row: 8, you: true },
      { id: 'priya', name: 'Priya', col: 4, row: 4, say: 'Can you hear me from here?' },
      { id: 'diego', name: 'Diego', col: 19, row: 8 },
    ],
  },
]

export const AUDIENCES = [
  { title: 'Language learning', text: 'Practise Nepali, Hindi, Spanish or any of 18 languages with people who actually speak it.', tags: 'नेपाली · हिन्दी · Español · 日本語' },
  { title: 'Topic discussion', text: 'Pull your group into a zone and keep the noise out. Add tags so the right people can find you.', tags: 'study groups · book clubs · tech talk' },
  { title: 'Debate', text: 'Up to eight voices. Listeners can stand nearby, and anyone can wander off when they’ve heard enough.', tags: 'friendly · structured · loud' },
  { title: 'Explore new apps & sites', text: 'Show what you found this week and see what everyone else found.', tags: 'show and tell · feedback' },
  { title: 'Just hanging out', text: 'No agenda. Sit by the campfire and see who walks over.', tags: 'drop in · say hi' },
]

export const TRUST = [
  { title: 'Straight to the room', text: 'Voice and chat go directly between the people in it, not through a server that records them.' },
  { title: 'Doors that lock', text: 'Private rooms need a join code, and repeated wrong guesses get blocked.' },
  { title: 'Your call, always', text: 'Mute, block or report anyone. Hosts can remove people from their room.' },
  { title: 'Rooms don’t linger', text: 'When everyone leaves, the room is gone.' },
]
