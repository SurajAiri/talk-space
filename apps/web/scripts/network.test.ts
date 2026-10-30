/** Run: pnpm --filter web test   (Node's built-in runner; no browser needed: WebRTC is replaced by a fake link) */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mock, test } from 'node:test'
import { NetworkManager, type AbuseReason } from '../src/webrtc/NetworkManager.ts'
import type { Link, PeerLinkOptions } from '../src/webrtc/PeerLink.ts'
import { TokenBucket, WindowCounter } from '../src/webrtc/RateLimiter.ts'
import { parseP2PMessage, type LinkState, type P2PMessage, type SignalData } from '../src/webrtc/types.ts'
import { hearingGain } from '../src/world/hearing.ts'
import { buildWorldMap, parseMapFile } from '../src/world/format/mapFile.ts'
import { WorldSession } from '../src/world/WorldSession.ts'

// ---------------------------------------------------------------- test doubles

class FakeLink implements Link {
  readonly remoteId: string
  readonly opts: PeerLinkOptions
  signals: SignalData[] = []
  sent: string[] = []
  posSent: string[] = []
  audioOn: boolean
  closed = false
  constructor(opts: PeerLinkOptions) {
    this.opts = opts
    this.remoteId = opts.remoteId
    this.audioOn = opts.audioEnabled ?? true
  }
  handleSignal(d: SignalData) { this.signals.push(d) }
  send(raw: string) { if (this.closed) return false; this.sent.push(raw); return true }
  sendUnreliable(raw: string) { this.posSent.push(raw); return true }
  setLocalTrack() {}
  setAudioEnabled(on: boolean) { this.audioOn = on }
  close() { this.closed = true }
  /** the remote peer "sends" us something over the data channel */
  recv(msg: unknown) { this.opts.onData(typeof msg === 'string' ? msg : JSON.stringify(msg)) }
  state(s: LinkState) { this.opts.onState(s) }
}

/* The fake socket accepts whatever payload a test throws at it, so `any` is deliberate here. */
/* eslint-disable @typescript-eslint/no-explicit-any */
function setup(over: Partial<ConstructorParameters<typeof NetworkManager>[0]> = {}) {
  const listeners = new Map<string, (p: any) => void>()
  const emitted: { ev: string; payload: any }[] = []
  const socket = {
    on: (ev: string, fn: (p: any) => void) => void listeners.set(ev, fn),
    off: (ev: string) => void listeners.delete(ev),
    emit: (ev: string, payload: any) => void emitted.push({ ev, payload }),
  } as never
  const links: FakeLink[] = []
  const messages: { from: string; msg: P2PMessage }[] = []
  const abuse: { id: string; reason: AbuseReason }[] = []
  const states: [string, LinkState][] = []
  let t = 0
  const mgr = new NetworkManager({
    selfId: 'm-self',
    socket,
    iceServers: [],
    chatMax: 2000,
    now: () => t,
    handlers: {
      onPeerState: (id, s) => states.push([id, s]),
      onPeerStream: () => {},
      onPeerMessage: (from, msg) => messages.push({ from, msg }),
      onPeerAbuse: (id, reason) => abuse.push({ id, reason }),
    },
    linkFactory: (o) => {
      const l = new FakeLink(o)
      links.push(l)
      return l
    },
    ...over,
  })
  const signal = (from: string, data: SignalData) => listeners.get('signal')!({ from, data })
  const latest = (id: string) => [...links].reverse().find((l) => l.remoteId === id)!
  return { listeners, mgr, links, messages, abuse, states, emitted, signal, latest, advance: (ms: number) => (t += ms) }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const chat = (i: number | string) => ({ type: 'chat', id: `c${i}`, text: `hello ${i}`, ts: 1 })

// ---------------------------------------------------------------- validation + limiter

test('parseP2PMessage accepts good messages and rejects everything else', () => {
  assert.deepEqual(parseP2PMessage(JSON.stringify(chat(1)), 100), chat(1))
  assert.equal(parseP2PMessage('{not json', 100), null)
  assert.equal(parseP2PMessage(JSON.stringify({ ...chat(1), text: 'x'.repeat(101) }), 100), null)
  assert.equal(parseP2PMessage(JSON.stringify({ ...chat(1), text: '   ' }), 100), null)
  assert.equal(parseP2PMessage(JSON.stringify({ type: 'pos', x: NaN, y: 1, dir: 'up', moving: false }), 100), null)
  assert.equal(parseP2PMessage(JSON.stringify({ type: 'pos', x: 1, y: 1, dir: 'sideways', moving: false }), 100), null)
  assert.equal(parseP2PMessage('x'.repeat(100_000), 100), null)
  assert.equal(parseP2PMessage(new ArrayBuffer(8), 100), null)
})

test('token bucket allows a burst, then only the refill rate', () => {
  let t = 0
  const b = new TokenBucket(5, 1, () => t)
  assert.equal([1, 2, 3, 4, 5, 6, 7].filter(() => b.take()).length, 5)
  t += 2000
  assert.equal([1, 2, 3].filter(() => b.take()).length, 2)
  t += 60_000
  assert.equal([1, 2, 3, 4, 5, 6, 7].filter(() => b.take()).length, 5) // never more than capacity
})

test('window counter forgets old events', () => {
  let t = 0
  const w = new WindowCounter(1000, () => t)
  w.hit(); w.hit()
  t += 1500
  assert.equal(w.hit(), 1)
})

// ---------------------------------------------------------------- receiving from peers

test('a peer cannot flood chat: only the burst gets through, and it is reported as abusive once', () => {
  const s = setup()
  s.mgr.connect('p1', true)
  const link = s.latest('p1')
  for (let i = 0; i < 1000; i++) link.recv(chat(i))
  const delivered = s.messages.filter((m) => m.msg.type === 'chat').length
  assert.ok(delivered <= 9, `expected at most the burst, got ${delivered}`)
  assert.equal(s.abuse.length, 1)
  assert.equal(s.abuse[0]!.id, 'p1')
  // reported again only after the cooldown
  for (let i = 0; i < 1000; i++) link.recv(chat(`b${i}`))
  assert.equal(s.abuse.length, 1)
  s.advance(31_000)
  for (let i = 0; i < 1000; i++) link.recv(chat(`c${i}`))
  assert.equal(s.abuse.length, 2)
})

test('garbage is dropped and also counts toward abuse', () => {
  const s = setup()
  s.mgr.connect('p1', true)
  for (let i = 0; i < 400; i++) s.latest('p1').recv('{"nope":' + i)
  assert.equal(s.messages.length, 0)
  assert.ok(s.abuse.some((a) => a.reason === 'garbage' || a.reason === 'flooding'))
})

test('an honest peer is never limited: steady chat and 10 position updates a second', () => {
  const s = setup()
  s.mgr.connect('p1', true)
  const link = s.latest('p1')
  for (let sec = 0; sec < 30; sec++) {
    link.recv(chat(sec))
    for (let i = 0; i < 10; i++) link.recv({ type: 'pos', x: 5, y: 5, dir: 'down', moving: true })
    s.advance(1000)
  }
  assert.equal(s.messages.filter((m) => m.msg.type === 'chat').length, 30)
  assert.equal(s.messages.filter((m) => m.msg.type === 'pos').length, 300)
  assert.equal(s.abuse.length, 0)
})

test('messages are attributed to the link they arrived on, never to a claimed sender', () => {
  const s = setup()
  s.mgr.connect('p1', true)
  s.latest('p1').recv({ ...chat(1), from: 'someone-else', fromId: 'someone-else' })
  assert.equal(s.messages[0]!.from, 'p1')
})

// ---------------------------------------------------------------- blocking

test('a blocked peer is ignored, gets none of our chat or voice, but still sees presence', () => {
  const s = setup()
  s.mgr.connect('p1', true)
  s.mgr.connect('p2', true)
  const [p1, p2] = [s.latest('p1'), s.latest('p2')]
  s.mgr.setBlocked('p1', true)
  p1.recv(chat(1))
  p2.recv(chat(2))
  assert.deepEqual(s.messages.map((m) => m.from), ['p2'])
  assert.equal(p1.audioOn, false)
  s.mgr.broadcast({ type: 'chat', id: 'mine', text: 'hi', ts: 1 })
  assert.equal(p1.sent.filter((x) => x.includes('"chat"')).length, 0)
  assert.equal(p2.sent.filter((x) => x.includes('"chat"')).length, 1)
  s.mgr.setPresence({ muted: true })
  assert.ok(p1.sent.some((x) => x.includes('"presence"')))
  // unblocking restores voice, unless the world still says they are out of earshot
  s.mgr.setBlocked('p1', false)
  assert.equal(p1.audioOn, true)
  s.mgr.setPeerAudio('p1', false)
  s.mgr.setBlocked('p1', true)
  s.mgr.setBlocked('p1', false)
  assert.equal(p1.audioOn, false)
})

// ---------------------------------------------------------------- signaling

test('signals that arrive before the peer is known are kept and replayed in order', () => {
  const s = setup()
  const offer = { description: { type: 'offer' as const, sdp: 'x' } }
  const cand = { candidate: { candidate: 'c1' } }
  s.signal('early', offer)
  s.signal('early', cand)
  s.mgr.connect('early', false)
  assert.deepEqual(s.latest('early').signals, [offer, cand])
})

test('buffered signals expire, and strangers cannot fill the buffer', () => {
  const s = setup()
  s.signal('old', { candidate: { candidate: 'a' } })
  s.advance(11_000)
  s.mgr.connect('old', false)
  assert.equal(s.latest('old').signals.length, 0)

  for (let i = 0; i < 100; i++) s.signal(`stranger${i}`, { candidate: { candidate: 'x' } })
  s.mgr.connect('stranger0', false) // the earliest strangers are kept...
  assert.equal(s.latest('stranger0').signals.length, 1)
  s.mgr.connect('stranger99', false) // ...later ones beyond the cap are not
  assert.equal(s.latest('stranger99').signals.length, 0)
})

test('a peer cannot make us buffer more than a handful of signals', () => {
  const s = setup()
  for (let i = 0; i < 500; i++) s.signal('spam', { candidate: { candidate: String(i) } })
  s.mgr.connect('spam', false)
  assert.equal(s.latest('spam').signals.length, 64)
})

test('a "reset" restarts the link without answering with another reset (no ping-pong)', () => {
  const s = setup()
  s.mgr.connect('zz', true) // 'm-self' < 'zz' so we are the lower id
  const before = s.latest('zz')
  s.signal('zz', { reset: true })
  assert.equal(before.closed, true)
  assert.notEqual(s.latest('zz'), before)
  assert.equal(s.latest('zz').opts.initiator, true) // lower id initiates
  assert.equal(s.emitted.filter((e) => e.payload?.data?.reset).length, 0)

  s.mgr.connect('aa', true) // 'm-self' > 'aa': they initiate
  s.signal('aa', { reset: true })
  assert.equal(s.latest('aa').opts.initiator, false)
  s.signal('nobody', { reset: true }) // unknown peer: ignored, nothing buffered
  assert.equal(s.links.some((l) => l.remoteId === 'nobody'), false)
})

// ---------------------------------------------------------------- recovery

test('a link that fails for good is rebuilt with backoff, at most three times, and tells the peer', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const s = setup()
    s.mgr.connect('zz', true)
    let link = s.latest('zz')
    const delays = [1000, 2000, 4000]
    for (const d of delays) {
      link.state('failed')
      mock.timers.tick(d - 1)
      assert.equal(s.latest('zz'), link, 'not rebuilt before the delay')
      mock.timers.tick(1)
      assert.notEqual(s.latest('zz'), link, `rebuilt after ${d} ms`)
      link = s.latest('zz')
    }
    assert.equal(s.emitted.filter((e) => e.payload?.data?.reset).length, 3)
    link.state('failed')
    mock.timers.tick(60_000)
    assert.equal(s.latest('zz'), link, 'gives up after three attempts')
  } finally {
    mock.timers.reset()
  }
})

test('success resets the retry budget', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const s = setup()
    s.mgr.connect('zz', true)
    s.latest('zz').state('failed')
    mock.timers.tick(1000)
    s.latest('zz').state('connected')
    s.latest('zz').state('failed')
    mock.timers.tick(1000) // first-attempt delay again, not the second
    assert.equal(s.links.filter((l) => l.remoteId === 'zz').length, 3)
  } finally {
    mock.timers.reset()
  }
})

test('events from a replaced link cannot touch the new one', () => {
  const s = setup()
  s.mgr.connect('p1', true)
  const old = s.latest('p1')
  s.mgr.connect('p1', true) // peer re-joined
  const fresh = s.latest('p1')
  s.states.length = 0
  old.recv(chat(1))
  old.state('failed')
  assert.equal(s.messages.length, 0)
  assert.equal(s.states.length, 0)
  fresh.state('connected')
  assert.deepEqual(s.states, [['p1', 'connected']])
})

test('reconcile keeps live links, dials newcomers, and drops people who left', () => {
  const s = setup()
  s.mgr.connect('stay', true)
  s.mgr.connect('gone', true)
  const stay = s.latest('stay')
  const gone = s.latest('gone')
  s.mgr.reconcile(['stay', 'new'])
  assert.equal(s.latest('stay'), stay)
  assert.equal(stay.closed, false) // the whole point: a signaling blip does not cut anyone off
  assert.equal(gone.closed, true)
  assert.equal(s.mgr.hasLink('gone'), false)
  assert.equal(s.latest('new').opts.initiator, true)
})

test('closing the manager closes every link and stops listening for signals', () => {
  const s = setup()
  s.mgr.connect('p1', true)
  s.mgr.close()
  assert.equal(s.latest('p1').closed, true)
  assert.equal(s.listeners.has('signal'), false) // no longer listening to the socket
})

// ---------------------------------------------------------------- audio gating

test('in a world voice starts off and follows the hearing decision; a new link honours it at once', () => {
  const s = setup({ audioDefault: false })
  s.mgr.connect('p1', true)
  assert.equal(s.latest('p1').audioOn, false)
  s.mgr.setPeerAudio('p1', true)
  assert.equal(s.latest('p1').audioOn, true)
  s.mgr.connect('p1', true) // rebuilt link remembers? no: a fresh peer starts from the default
  assert.equal(s.latest('p1').audioOn, false)
})

test('chat and presence reach every open link; positions go on the unreliable channel and are replayed to late channels', () => {
  const s = setup()
  s.mgr.connect('p1', true)
  assert.equal(s.mgr.broadcast({ type: 'chat', id: 'a', text: 'yo', ts: 1 }), 1)
  assert.equal(s.mgr.sendPosition({ type: 'pos', x: 1, y: 2, dir: 'up', moving: false }), 1)
  s.mgr.connect('p2', true)
  s.latest('p2').opts.onPosOpen?.()
  assert.equal(s.latest('p2').posSent.length, 1)
})

// ---------------------------------------------------------------- world: teleport limit + audio gate

// maps/index.ts discovers maps with Vite's import.meta.glob, which plain Node doesn't have,
// so load one map file straight from disk and build it the same way the app does.
const parsed = parseMapFile(
  JSON.parse(readFileSync(new URL('../src/world/maps/data/commons.map.json', import.meta.url), 'utf8')),
)
assert.ok(parsed.map, 'commons.map.json should be a valid map file')
const map = buildWorldMap(parsed.map)

test('a remote avatar cannot teleport: a huge jump is turned into a bounded step', () => {
  const w = new WorldSession({ map, selfId: 'me' })
  try {
    w.onRemotePosition('p', { type: 'pos', x: 2, y: 2, dir: 'down', moving: false })
    w.onRemotePosition('p', { type: 'pos', x: 40, y: 30, dir: 'down', moving: true })
    const r = w.remotes.get('p')!
    assert.ok(Math.hypot(r.x - 2, r.y - 2) < 3, `moved ${Math.hypot(r.x - 2, r.y - 2).toFixed(1)} tiles instantly`)
    // out-of-map claims are clamped
    w.onRemotePosition('q', { type: 'pos', x: 9999, y: -50, dir: 'down', moving: false })
    const q = w.remotes.get('q')!
    assert.ok(q.x < map.cols && q.y >= 0)
  } finally {
    w.close()
  }
})

test('voice is sent only to people who can hear us, stops after a delay out of range, and never to blocked people', async () => {
  const w = new WorldSession({ map, selfId: 'me' })
  const calls: [string, boolean][] = []
  w.attach(() => {}, (id, on) => calls.push([id, on]))
  try {
    const here = w.local
    // pick a far-away spot that really is out of earshot
    let far = { x: here.x, y: here.y }
    for (const [dx, dy] of [[15, 0], [-15, 0], [0, 15], [0, -15], [12, 12], [-12, -12]] as const) {
      const c = { x: Math.min(Math.max(here.x + dx, 0.5), map.cols - 1), y: Math.min(Math.max(here.y + dy, 0.5), map.rows - 1) }
      if (hearingGain(map, here, { ...c, dir: 'down', moving: false }) === 0) { far = c; break }
    }
    assert.equal(hearingGain(map, here, { ...far, dir: 'down', moving: false }), 0, 'test setup: far spot must be out of range')

    w.onRemotePosition('near', { type: 'pos', x: here.x + 0.5, y: here.y, dir: 'down', moving: false })
    w.onRemotePosition('far', { type: 'pos', ...far, dir: 'down', moving: false })
    await new Promise((r) => setTimeout(r, 250)) // a couple of 100 ms ticks
    assert.deepEqual(calls.filter((c) => c[0] === 'near').at(-1), ['near', true])
    // out of range from the start: never switched on at all
    assert.equal(calls.filter((c) => c[0] === 'far' && c[1]).length, 0)

    // now someone walks out of range: off only after the delay (no flapping at the edge)
    w.onRemotePosition('near', { type: 'pos', ...far, dir: 'down', moving: true }) // clamped to a short hop...
    w.remotes.set('near', { ...far, dir: 'down', moving: false }) // ...so place it directly for this check
    await new Promise((r) => setTimeout(r, 450))
    assert.deepEqual(calls.filter((c) => c[0] === 'near').at(-1), ['near', true], 'still on inside the delay')
    await new Promise((r) => setTimeout(r, 900))
    assert.deepEqual(calls.filter((c) => c[0] === 'near').at(-1), ['near', false])

    // blocking cuts voice immediately, even for someone standing right next to us
    w.remotes.set('near', { x: here.x + 0.5, y: here.y, dir: 'down', moving: false })
    await new Promise((r) => setTimeout(r, 250))
    assert.deepEqual(calls.filter((c) => c[0] === 'near').at(-1), ['near', true])
    w.setBlockedIds(new Set(['near']))
    assert.deepEqual(calls.filter((c) => c[0] === 'near').at(-1), ['near', false])
  } finally {
    w.close()
  }
})
