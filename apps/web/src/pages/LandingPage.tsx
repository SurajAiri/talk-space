import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, RefObject } from 'react'
import { Link, Navigate } from 'react-router'
import { LogoMark } from '../components/Logo'
import { useAuthStore } from '../store/auth.store'
import './landing.css'

/* ------------------------------------------------------------------ content */

const LANGS = [
  'English', 'नेपाली', 'हिन्दी', 'বাংলা', 'اردو', 'தமிழ்', 'Español', 'Français', 'Deutsch',
  'Português', 'Русский', 'العربية', '中文', '日本語', '한국어', 'Bahasa Indonesia', 'Türkçe', 'Italiano',
]

const FEATURES = [
  { title: 'Hear by distance', text: 'Within a couple of steps you hear someone at full volume. Farther out they fade away, so a crowded room never turns into noise.' },
  { title: 'Zones for focus', text: 'Café corners, library nooks, campfire decks. Everyone inside a zone hears each other clearly, and the rest of the room goes quiet.' },
  { title: 'Talk or type', text: 'Speak when you’re ready, or start with text chat. Message the whole room, or send a private note to one person.' },
  { title: 'You stay in control', text: 'Mute, block, or report anyone in a click. Room creators can remove people, and private rooms need a join code.' },
]

const STEPS = [
  { title: 'Pick a room', text: 'Browse live public rooms by language, purpose or tag, like language learning, debate or a casual hangout. Or start your own, public or private.' },
  { title: 'Walk in', text: 'Move around the map with your keyboard, or the on-screen joystick on your phone. A chip always shows who can hear you right now.' },
  { title: 'Just talk', text: 'Drift toward a chat that sounds interesting, or settle into a quiet corner. Your voice goes straight to the people nearby.' },
]

type Shape = [left: number, top: number, width: number, height: number, color: string, round?: boolean]
interface World {
  name: string
  blurb: string
  bg: string
  shapes: Shape[]
  dots: [number, number][]
}

const WORLDS: World[] = [
  {
    name: 'Courtyard Commons',
    blurb: 'Café & lounge, game room, maker nook and a campfire deck.',
    bg: 'linear-gradient(160deg,#5d8f5a,#3e7048)',
    shapes: [[6, 14, 36, 46, '#b98a5b'], [50, 36, 28, 44, '#e8c070', true], [78, 12, 18, 36, '#7f6aa8']],
    dots: [[22, 40], [60, 58]],
  },
  {
    name: 'Pinewood Lodge',
    blurb: 'A fireplace hall, library nook, lakeside dock and hot-tub terrace.',
    bg: 'linear-gradient(160deg,#4a3b2c,#2c2a1f)',
    shapes: [[5, 10, 48, 52, '#7a4f33'], [58, 10, 26, 52, '#5b3f6a'], [10, 72, 80, 22, '#2f6c8c']],
    dots: [[28, 34], [70, 36]],
  },
  {
    name: 'Sunset Beach',
    blurb: 'A smoothie deck, bonfire circle and an overwater pier.',
    bg: 'linear-gradient(180deg,#f2a65a 0%,#e8c98f 42%,#4aa3b8 100%)',
    shapes: [[8, 46, 30, 42, '#ef7a3c', true], [46, 12, 34, 36, '#c58a52'], [76, 58, 20, 26, '#8a5a34']],
    dots: [[22, 66], [60, 34]],
  },
  {
    name: 'Sky Night Market',
    blurb: 'Lantern-lit lanes, a glass conservatory and a tea pavilion on a pond.',
    bg: 'linear-gradient(160deg,#1b2552,#2b1f4a)',
    shapes: [[7, 13, 38, 52, 'rgba(94,224,176,.3)'], [62, 48, 32, 44, 'rgba(240,183,74,.35)', true]],
    dots: [[26, 40], [74, 70]],
  },
]

const AUDIENCES = [
  { tag: 'Language learners', title: 'Practise out loud', text: 'Find a room in Nepali, Hindi, Spanish, Japanese and more, and speak with people who use the language every day. Low pressure, real conversation.' },
  { tag: 'Study & discussion groups', title: 'Talk it through together', text: 'Pull up a seat in the library nook with your group and keep the rest of the room out of earshot. Add tags so people interested in your topic find you.' },
  { tag: 'Debaters', title: 'Argue, then wander off', text: 'Host a debate with up to eight people. Spectators can listen from nearby, and anyone can walk away when they’ve heard enough.' },
  { tag: 'Curious explorers', title: 'Hang out, discover', text: 'Swap new apps and sites, meet new people, or just sit by the bonfire. No agenda needed.' },
]

const TRUST = [
  { title: 'Direct voice', text: 'Voice and chat travel directly between people in the room, not through a recording server.' },
  { title: 'Private by code', text: 'Private rooms are joined with a secret code, and repeated wrong guesses are blocked.' },
  { title: 'Block & report', text: 'Block anyone for yourself, report abuse to moderators, and hosts can remove people from their room.' },
  { title: 'Rooms that fade', text: 'Rooms are temporary. When everyone leaves, the room goes with them.' },
]

/* --------------------------------------------------------- live hearing demo */

/** Same falloff as src/world/hearing.ts: full volume inside 2 tiles, silent past 7, quadratic between. */
const FULL = 2
const MAX = 7
const TILES_ACROSS = 12 // the demo stage is 12 tiles wide
const ASPECT = 440 / 480 // height / width

function hearing(d: number): number {
  if (d <= FULL) return 1
  if (d >= MAX) return 0
  const t = (MAX - d) / (MAX - FULL)
  return t * t
}

interface Peer {
  name: string
  hue: number
  x: number
  y: number
  say?: string
}

const PEERS: Peer[] = [
  { name: 'Priya', hue: 262, x: 0.72, y: 0.3, say: 'नमस्ते! Join us?' },
  { name: 'Diego', hue: 150, x: 0.22, y: 0.72, say: '¿Practicamos juntos?' },
  { name: 'Hana', hue: 18, x: 0.8, y: 0.84 },
  { name: 'Leo', hue: 212, x: 0.07, y: 0.1 },
]

const clamp = (n: number) => Math.min(0.97, Math.max(0.03, n))

function Stage() {
  const ref = useRef<HTMLDivElement>(null)
  const [you, setYou] = useState({ x: 0.5, y: 0.56 })
  const [touched, setTouched] = useState(false)

  // Until the visitor takes over, "You" wanders slowly so the hero feels alive.
  useEffect(() => {
    if (touched || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const tick = (t: number) => {
      setYou({ x: 0.5 + 0.17 * Math.sin(t / 2600), y: 0.56 + 0.13 * Math.sin(t / 1900 + 1) })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [touched])

  const moveTo = (clientX: number, clientY: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setYou({ x: clamp((clientX - r.left) / r.width), y: clamp((clientY - r.top) / r.height) })
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    setTouched(true)
    moveTo(e.clientX, e.clientY)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || e.buttons) {
      setTouched(true)
      moveTo(e.clientX, e.clientY)
    }
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 0.04
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    const d = delta[e.key]
    if (!d) return
    e.preventDefault()
    setTouched(true)
    setYou((p) => ({ x: clamp(p.x + d[0]), y: clamp(p.y + d[1]) }))
  }

  return (
    <div
      ref={ref}
      className="lp-stage"
      tabIndex={0}
      role="group"
      aria-label="Interactive demo. Move your mouse, tap, or use the arrow keys to walk around. People near you get louder, people far away fade out."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <div className="lp-stage-glow" />
      <div className="lp-rings" style={{ left: `${you.x * 100}%`, top: `${you.y * 100}%` }}>
        <i className="lp-ring lp-ring-max" />
        <i className="lp-ring lp-ring-mid" />
        <i className="lp-ring lp-ring-full" />
        <i className="lp-ripple" />
        <i className="lp-ripple" style={{ animationDelay: '-2.5s' }} />
        <span className="lp-you"><b /></span>
        <span className="lp-you-label">You</span>
      </div>

      {PEERS.map((p, i) => {
        const d = Math.hypot((p.x - you.x) * TILES_ACROSS, (p.y - you.y) * TILES_ACROSS * ASPECT)
        const g = hearing(d)
        const pct = Math.round(g * 100)
        return (
          <div key={p.name} className="lp-peer" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, opacity: 0.4 + 0.6 * g }}>
            <span className={`lp-peer-dot lp-float-${(i % 3) + 1}`} style={{ background: `oklch(0.86 0.09 ${p.hue})`, color: `oklch(0.32 0.1 ${p.hue})` }}>
              {p.name[0]}
            </span>
            <span className="lp-peer-pill">
              {p.name}
              {p.say && pct > 0 && <span className="lp-eq" aria-hidden="true"><i /><i /><i /></span>}
              <span className={pct > 0 ? 'lp-pct' : 'lp-pct lp-out'}>{pct > 0 ? `${pct}%` : 'out of earshot'}</span>
            </span>
            {p.say && (
              <span className="lp-bubble-wrap" style={{ opacity: g > 0.15 ? 1 : 0 }} aria-hidden="true">
                <span className="lp-bubble" style={{ animationDelay: `${-i * 3}s` }}>{p.say}</span>
              </span>
            )}
          </div>
        )
      })}

      <p className="lp-hint">{touched ? 'The closer you stand, the clearer you hear.' : 'Move your mouse, tap, or use the arrow keys'}</p>
    </div>
  )
}

/* ------------------------------------------------------------------- page */

function useReveal(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const items = el.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.classList.add('lp-ready')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('lp-in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12 },
    )
    items.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [root])
}

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null)
  const user = useAuthStore((s) => s.user)
  useReveal(root)

  // Signed-in people go straight to their rooms. Everyone else sees the page at once (no loading splash).
  if (user) return <Navigate to="/home" replace />

  return (
    <div className="lp" ref={root}>
      {/* ---------- hero ---------- */}
      <header className="lp-hero">
        <nav className="lp-wrap lp-nav" aria-label="Main">
          <a href="#top" className="lp-brand"><LogoMark size={34} />Talk Space</a>
          <div className="lp-navlinks">
            <a href="#how">How it works</a>
            <a href="#spaces">Spaces</a>
            <a href="#who">Who it’s for</a>
            <a href="#safety">Safety</a>
          </div>
          <div className="lp-navcta">
            <Link to="/auth" className="lp-login">Log in</Link>
            <Link to="/auth?mode=signup" className="lp-btn lp-btn-light">Join a room</Link>
          </div>
        </nav>

        <div className="lp-wrap lp-herogrid" id="top">
          <div className="lp-herocopy">
            <span className="lp-eyebrow lp-up"><i className="lp-live" />Voice rooms you can walk around in</span>
            <h1 className="lp-up lp-d1">Walk over to a <em>conversation.</em></h1>
            <p className="lp-lead lp-up lp-d2">
              Stand close to someone and you hear them clearly. Step away and they fade, like in a real room.
              No cameras, no one talking over everyone, just people and the space between them.
            </p>
            <div className="lp-actions lp-up lp-d3">
              <Link to="/auth?mode=signup" className="lp-btn lp-btn-brand">Create your account</Link>
              <a href="#how" className="lp-btn lp-btn-line">See how it works</a>
            </div>
            <ul className="lp-facts lp-up lp-d3">
              <li>Up to 8 people per room</li><li>18 languages</li><li>Voice and text chat</li><li>No camera needed</li>
            </ul>
          </div>
          <div className="lp-up lp-d2 lp-stagewrap"><Stage /></div>
        </div>
      </header>

      {/* ---------- languages ---------- */}
      <section className="lp-langs" aria-label="Supported languages">
        <p>Rooms in 18 languages, and counting</p>
        <div className="lp-marquee">
          <div className="lp-track">
            {[0, 1].map((copy) =>
              LANGS.map((l) => (
                <span key={`${copy}-${l}`} className="lp-chip" aria-hidden={copy === 1 ? true : undefined}>{l}</span>
              )),
            )}
          </div>
        </div>
      </section>

      {/* ---------- idea ---------- */}
      <section className="lp-sec lp-light">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <p className="lp-kicker">The idea</p>
            <h2>Conversations that sound like conversations.</h2>
            <p className="lp-sub">Most group calls make one voice at a time win. In Talk Space the room has a shape, so several chats can happen at once and you simply walk to the one you want.</p>
          </div>
          <div className="lp-grid lp-grid-250">
            {FEATURES.map((f, i) => (
              <article key={f.title} className="lp-card" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <span className={`lp-ico lp-ico-${i + 1}`} aria-hidden="true"><i /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- how ---------- */}
      <section className="lp-sec lp-dark" id="how">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <p className="lp-kicker lp-kicker-dark">How it works</p>
            <h2>From “hello” to talking in three steps.</h2>
          </div>
          <div className="lp-grid lp-grid-280">
            {STEPS.map((s, i) => (
              <article key={s.title} className="lp-card lp-card-dark" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <span className={i === 2 ? 'lp-num lp-num-live' : 'lp-num'}>0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- worlds ---------- */}
      <section className="lp-sec lp-dark2" id="spaces">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <p className="lp-kicker lp-kicker-dark">Worlds to explore</p>
            <h2>A place for every kind of talk.</h2>
            <p className="lp-sub">Pick the setting that fits the mood. Each one has its own private corners built in.</p>
          </div>
          <div className="lp-grid lp-grid-260">
            {WORLDS.map((w, i) => (
              <article key={w.name} className="lp-card lp-card-dark lp-world" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="lp-scene" style={{ background: w.bg }} aria-hidden="true">
                  {w.shapes.map((s, j) => (
                    <span key={j} className="lp-zone" style={{ left: `${s[0]}%`, top: `${s[1]}%`, width: `${s[2]}%`, height: `${s[3]}%`, background: s[4], borderRadius: s[5] ? '50%' : 12 }} />
                  ))}
                  {w.dots.map((d, j) => (
                    <span key={j} className={`lp-dot lp-float-${((i + j) % 3) + 1}`} style={{ left: `${d[0]}%`, top: `${d[1]}%` }} />
                  ))}
                </div>
                <div className="lp-worldtext">
                  <h3>{w.name}</h3>
                  <p>{w.blurb}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- who ---------- */}
      <section className="lp-sec lp-light" id="who">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <p className="lp-kicker">Who it’s for</p>
            <h2>Everyone gets a seat.</h2>
            <p className="lp-sub">Whether you’re here to practise a language, argue a point, study with others or just hear friendly voices, there’s a room shaped for you. And if you’d rather listen first, that’s welcome too.</p>
          </div>
          <div className="lp-grid lp-grid-260">
            {AUDIENCES.map((a, i) => (
              <article key={a.tag} className="lp-card" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <span className={`lp-tag lp-tag-${i + 1}`}>{a.tag}</span>
                <h3>{a.title}</h3>
                <p>{a.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- safety ---------- */}
      <section className="lp-sec lp-dark" id="safety">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <p className="lp-kicker lp-kicker-live">Safe to walk into</p>
            <h2>Built so you can relax.</h2>
          </div>
          <div className="lp-grid lp-grid-250">
            {TRUST.map((t, i) => (
              <div key={t.title} className="lp-trust" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- final call ---------- */}
      <section className="lp-final lp-dark">
        <div className="lp-wrap">
          <div className="lp-cta" data-reveal>
            <i className="lp-cta-ring lp-cta-ring-a" /><i className="lp-cta-ring lp-cta-ring-b" />
            <h2>Your seat is waiting.</h2>
            <p>Create an account, pick a name, and walk into a room. Someone’s already talking.</p>
            <div className="lp-actions lp-center">
              <Link to="/auth?mode=signup" className="lp-btn lp-btn-light lp-btn-lg">Create your account</Link>
              <Link to="/auth" className="lp-btn lp-btn-ghostw lp-btn-lg">Log in</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <span className="lp-brand lp-brand-sm"><LogoMark size={26} />Talk Space</span>
          <span>The closer you stand, the clearer you hear.</span>
          <span className="lp-footlinks"><a href="#how">How it works</a><a href="#safety">Safety</a><Link to="/auth">Log in</Link></span>
        </div>
      </footer>
    </div>
  )
}
