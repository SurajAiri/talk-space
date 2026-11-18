/** Run: pnpm --filter web test   (the state machine needs nothing; the engine tests use the headless harness) */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DECLINE_COOLDOWN_MS,
  FollowManager,
  REQUEST_GAP_MS,
  REQUEST_TTL_MS,
  type FollowEvent,
  type FollowOp,
} from '../src/world/follow.ts'
import { findPath, findPathToward, isTileBlocked } from '../src/world/navigation.ts'
import { TILE, type WorldMap } from '../src/world/types.ts'
import { loadMap, makeEngine } from './engineHarness.ts'

// ---------------------------------------------------------------- a tiny network: managers wired through a queue

interface Msg {
  from: string
  to: string
  op: FollowOp
}

/** People are managers; messages wait in `inflight` until flush(), so a test can make them cross in the post. */
function room(...ids: string[]) {
  let t = 100_000
  const inflight: Msg[] = []
  const log: Msg[] = []
  const down = new Set<string>() // people nobody can reach
  const blocked = new Map<string, Set<string>>()
  const events = new Map<string, FollowEvent[]>()
  const people = new Map<string, FollowManager>()

  for (const id of ids) {
    events.set(id, [])
    blocked.set(id, new Set())
    people.set(
      id,
      new FollowManager({
        now: () => t,
        isBlocked: (x) => blocked.get(id)!.has(x),
        onEvent: (e) => events.get(id)!.push(e),
        send: (to, op) => {
          if (down.has(to) || !people.has(to)) return false
          const m = { from: id, to, op }
          inflight.push(m)
          log.push(m)
          return true
        },
      }),
    )
  }
  const net = {
    p: (id: string) => people.get(id)!,
    events: (id: string) => events.get(id)!,
    log,
    inflight,
    down,
    block: (who: string, whom: string) => blocked.get(who)!.add(whom),
    advance: (ms: number) => {
      t += ms
      for (const m of people.values()) m.tick()
    },
    /** deliver everything in flight (and whatever that causes) */
    flush() {
      let guard = 0
      while (inflight.length && guard++ < 100) {
        const m = inflight.shift()!
        people.get(m.to)!.receive(m.from, m.op)
      }
    },
  }
  return net
}

const sent = (net: ReturnType<typeof room>) => net.log.map((m) => `${m.from}>${m.to}:${m.op}`)

// ---------------------------------------------------------------- the consent protocol

test('ask, accept: the follower follows, the leader lists the follower, and both sides agree', () => {
  const n = room('a', 'b')
  assert.equal(n.p('a').request('b'), 'sent')
  assert.equal(n.p('a').snapshot.pending, 'b')
  assert.equal(n.p('a').snapshot.following, null, 'asking is not following')
  n.flush()
  assert.deepEqual(n.p('b').snapshot.incoming, ['a'])
  assert.deepEqual(n.events('b'), [{ kind: 'incoming', from: 'a' }])
  assert.equal(n.p('b').snapshot.followers.length, 0, 'not until they say yes')

  assert.equal(n.p('b').accept('a'), true)
  n.flush()
  assert.deepEqual(n.p('a').snapshot, { following: 'b', paused: false, pending: null, incoming: [], followers: [] })
  assert.deepEqual(n.p('b').snapshot, { following: null, paused: false, pending: null, incoming: [], followers: ['a'] })
  assert.deepEqual(n.events('a'), [{ kind: 'accepted', by: 'b' }])
})

test('a decline ends the request and keeps the same request from coming back for a minute, from either side', () => {
  const n = room('a', 'b')
  n.p('a').request('b')
  n.flush()
  n.p('b').decline('a')
  n.flush()
  assert.equal(n.p('a').snapshot.pending, null)
  assert.deepEqual(n.events('a'), [{ kind: 'declined', by: 'b' }])

  n.advance(REQUEST_GAP_MS + 1)
  assert.equal(n.p('a').request('b'), 'cooldown', 'the person who was declined cannot ask again yet')
  // a modified client could ignore its own cooldown: the leader's side ignores it too
  n.p('b').receive('a', 'request')
  assert.deepEqual(n.p('b').snapshot.incoming, [], 'ignored without a word')

  n.advance(DECLINE_COOLDOWN_MS)
  assert.equal(n.p('a').request('b'), 'sent')
})

test('an `accept` nobody asked for does not make us follow: only the person we asked can say yes', () => {
  const n = room('a', 'b', 'c')
  // c sends an accept out of the blue
  n.p('a').receive('c', 'accept')
  assert.equal(n.p('a').snapshot.following, null)
  assert.deepEqual(sent(n), ['a>c:stop'], 'and c is told it did not count')

  // a asks b: an accept from c still does not count
  n.p('a').request('b')
  n.p('a').receive('c', 'accept')
  assert.equal(n.p('a').snapshot.following, null)
  assert.equal(n.p('a').snapshot.pending, 'b', 'the real request is untouched')
  // and a second accept from b after a has already followed b is nothing new either
  n.p('a').receive('b', 'accept')
  assert.equal(n.p('a').snapshot.following, 'b')
  const before = n.p('a').snapshot
  n.p('a').receive('b', 'accept')
  assert.equal(n.p('a').snapshot, before, 'nothing changed, so nothing is announced')
})

test('a yes that arrives after the request lapsed is cleaned up on the leader’s side too', () => {
  const n = room('a', 'b')
  n.p('a').request('b')
  n.flush()
  n.advance(REQUEST_TTL_MS - 100) // b still has the prompt...
  assert.equal(n.p('b').accept('a'), true) // ...and says yes; the message is now in the post
  n.advance(200) // a gives up before it arrives
  assert.deepEqual(n.events('a').at(-1), { kind: 'timeout', to: 'b' })
  n.flush()
  assert.equal(n.p('a').snapshot.following, null, 'a never agreed to follow anyone')
  assert.deepEqual(n.p('b').snapshot.followers, [], 'so b does not keep a ghost follower: a answered the late yes with a stop')
})

test('a request nobody answers lapses on both sides, and the prompt goes away', () => {
  const n = room('a', 'b')
  n.p('a').request('b')
  n.flush()
  n.advance(REQUEST_TTL_MS + 1)
  assert.equal(n.p('a').snapshot.pending, null)
  assert.deepEqual(n.events('a'), [{ kind: 'timeout', to: 'b' }])
  assert.deepEqual(n.events('b').at(-1), { kind: 'incoming-gone', from: 'a' })
  assert.equal(n.p('b').accept('a'), false, 'too late to accept')
})

test('cancelling a request takes the prompt away from the other person', () => {
  const n = room('a', 'b')
  n.p('a').request('b')
  n.flush()
  n.p('a').cancelRequest()
  n.flush()
  assert.equal(n.p('a').snapshot.pending, null)
  assert.deepEqual(n.p('b').snapshot.incoming, [])
  assert.deepEqual(n.events('b').at(-1), { kind: 'incoming-gone', from: 'a' })
})

test('asking someone else replaces an open request; asking while following only switches once the new person says yes', () => {
  const n = room('a', 'b', 'c')
  n.p('a').request('b')
  n.advance(REQUEST_GAP_MS + 1)
  assert.equal(n.p('a').request('c'), 'sent')
  n.flush()
  assert.equal(n.p('a').snapshot.pending, 'c')
  assert.deepEqual(n.p('b').snapshot.incoming, [], 'b’s prompt is withdrawn')
  assert.deepEqual(n.p('c').snapshot.incoming, ['a'])

  n.p('c').accept('a')
  n.flush()
  assert.equal(n.p('a').snapshot.following, 'c')

  n.advance(REQUEST_GAP_MS + 1)
  n.p('a').request('b')
  n.flush()
  assert.equal(n.p('a').snapshot.following, 'c', 'still following c while b thinks about it')
  n.p('b').accept('a')
  n.flush()
  assert.equal(n.p('a').snapshot.following, 'b')
  assert.deepEqual(n.p('c').snapshot.followers, [], 'c is told a moved on')
  assert.deepEqual(n.p('b').snapshot.followers, ['a'])
})

test('either side can end it with `stop`, and the other side hears about it', () => {
  const setUp = () => {
    const n = room('a', 'b')
    n.p('a').request('b')
    n.flush()
    n.p('b').accept('a')
    n.flush()
    return n
  }
  const byFollower = setUp()
  byFollower.p('a').stopFollowing()
  byFollower.flush()
  assert.equal(byFollower.p('a').snapshot.following, null)
  assert.deepEqual(byFollower.p('b').snapshot.followers, [])
  assert.deepEqual(byFollower.events('b').at(-1), { kind: 'lost-follower', id: 'a', reason: 'stopped' })

  const byLeader = setUp()
  byLeader.p('b').removeFollower('a')
  byLeader.flush()
  assert.equal(byLeader.p('a').snapshot.following, null)
  assert.deepEqual(byLeader.events('a').at(-1), { kind: 'lost-leader', id: 'b', reason: 'removed' })
})

test('moving by hand only pauses following: the leader’s yes still stands and resume needs no new request', () => {
  const n = room('a', 'b')
  n.p('a').request('b')
  n.flush()
  n.p('b').accept('a')
  n.flush()
  const sentBefore = n.log.length

  n.p('a').pause()
  assert.deepEqual([n.p('a').snapshot.following, n.p('a').snapshot.paused], ['b', true])
  assert.deepEqual(n.p('b').snapshot.followers, ['a'], 'the leader is not told, and still has them')
  n.p('a').pause()
  n.p('a').resume()
  assert.deepEqual([n.p('a').snapshot.following, n.p('a').snapshot.paused], ['b', false])
  assert.equal(n.log.length, sentBefore, 'nothing went over the network')

  n.p('a').stopFollowing()
  n.p('a').pause() // nothing to pause any more
  assert.equal(n.p('a').snapshot.paused, false)
})

test('asking again after you were already a follower asks the leader again, instead of silently counting', () => {
  const n = room('a', 'b')
  n.p('a').request('b')
  n.flush()
  n.p('b').accept('a')
  n.flush()
  n.p('b').receive('a', 'request') // a lost track of it (say, a restarted) and asks again
  assert.deepEqual(n.p('b').snapshot.followers, [])
  assert.deepEqual(n.p('b').snapshot.incoming, ['a'], 'a fresh question, for b to answer')
})

test('a person leaving ends every follow with them; nothing is sent to someone who is gone', () => {
  const n = room('a', 'b', 'c')
  n.p('a').request('b')
  n.flush()
  n.p('b').accept('a')
  n.flush()
  n.p('c').request('a')
  n.flush()
  const sentBefore = n.log.length

  n.p('a').peerLeft('b')
  n.p('a').peerLeft('c')
  assert.deepEqual(n.p('a').snapshot, { following: null, paused: false, pending: null, incoming: [], followers: [] })
  assert.deepEqual(n.events('a').filter((e) => e.kind === 'lost-leader'), [{ kind: 'lost-leader', id: 'b', reason: 'left' }])
  assert.deepEqual(n.events('a').at(-1), { kind: 'incoming-gone', from: 'c' })
  assert.equal(n.log.length, sentBefore)
})

test('blocking someone ends the follow in either direction, tells them only `stop`, and shuts their requests out', () => {
  const n = room('a', 'b', 'c')
  // b follows a; a follows c; and b has an open request to a too (a second one is not possible, so use c)
  n.p('b').request('a')
  n.flush()
  n.p('a').accept('b')
  n.p('a').request('c')
  n.flush()
  n.p('c').accept('a')
  n.flush()
  n.log.length = 0

  n.block('a', 'b')
  n.p('a').peerBlocked('b')
  n.block('a', 'c')
  n.p('a').peerBlocked('c')
  n.flush()
  assert.deepEqual(sent(n), ['a>b:stop', 'a>c:stop'])
  assert.deepEqual(n.p('a').snapshot, { following: null, paused: false, pending: null, incoming: [], followers: [] })
  assert.equal(n.p('b').snapshot.following, null, 'b’s browser stops chasing a')

  n.p('a').receive('b', 'request')
  assert.deepEqual(n.p('a').snapshot.incoming, [], 'a blocked person cannot ask')
  assert.equal(n.p('a').request('b'), 'blocked')
  n.p('a').peerBlocked('nobody') // no relation: nothing to do, nothing sent
  assert.equal(n.log.length, 2)
})

test('a request that cannot be delivered changes nothing, and does not cancel the open one', () => {
  const n = room('a', 'b', 'c')
  n.p('a').request('b')
  n.advance(REQUEST_GAP_MS + 1)
  n.down.add('c')
  assert.equal(n.p('a').request('c'), 'unreachable')
  assert.equal(n.p('a').snapshot.pending, 'b')
  n.down.delete('c')
  n.down.add('a')
  n.p('b').receive('a', 'request') // a is unreachable by b: a yes cannot be delivered
  assert.equal(n.p('b').accept('a'), false)
  assert.deepEqual(n.p('b').snapshot.followers, [], 'no follower who was never told')
})

test('requests cannot be fired off in rapid succession, and asking the same person twice is a no-op', () => {
  const n = room('a', 'b', 'c')
  assert.equal(n.p('a').request('b'), 'sent')
  assert.equal(n.p('a').request('b'), 'already')
  assert.equal(n.p('a').request('c'), 'slow-down')
  n.advance(REQUEST_GAP_MS)
  assert.equal(n.p('a').request('c'), 'sent')
  assert.equal(n.log.filter((m) => m.op === 'request').length, 2)
})

test('subscribers hear about real changes only, and the snapshot is the same object until something changes', () => {
  const n = room('a', 'b')
  let calls = 0
  const off = n.p('a').subscribe(() => calls++)
  const s0 = n.p('a').snapshot
  n.p('a').pause() // not following: nothing to do
  n.p('a').resume()
  n.p('a').cancelRequest()
  n.p('a').stopFollowing()
  n.p('a').receive('b', 'decline') // nothing was asked
  assert.equal(calls, 0)
  assert.equal(n.p('a').snapshot, s0)
  n.p('a').request('b')
  assert.equal(calls, 1)
  assert.notEqual(n.p('a').snapshot, s0)
  off()
  n.p('a').cancelRequest()
  assert.equal(calls, 1, 'unsubscribed')
})

test('a fresh network forgets everything, and takes any prompt with it', () => {
  const n = room('a', 'b')
  n.p('b').request('a')
  n.flush()
  n.p('a').reset()
  assert.deepEqual(n.p('a').snapshot.incoming, [])
  assert.deepEqual(n.events('a').at(-1), { kind: 'incoming-gone', from: 'b' })
})

// ---------------------------------------------------------------- pathfinding toward a moving person

const open = loadMap('beach')
const ROW = 15 // a long open walkway on the beach map: columns 16..47 are free

test('findPathToward ends on the target when it can, within reach when told to, and is [] when already there', () => {
  const p = findPathToward(open, { col: 16, row: ROW }, { col: 24, row: ROW })!
  assert.equal(p.length, 8)
  assert.deepEqual(p.at(-1), { x: (24 + 0.5) * TILE, y: (ROW + 0.5) * TILE })
  const near = findPathToward(open, { col: 16, row: ROW }, { col: 24, row: ROW }, 1)!
  assert.equal(near.length, 7, 'within one tile: stops next to them')
  assert.deepEqual(findPathToward(open, { col: 24, row: ROW }, { col: 24, row: ROW }), [])
  assert.deepEqual(findPathToward(open, { col: 23, row: ROW }, { col: 24, row: ROW }, 1), [])
})

test('findPathToward agrees with findPath about the length of an ordinary walk', () => {
  const a = findPath(open, { col: 16, row: ROW }, { col: 30, row: ROW })!
  const b = findPathToward(open, { col: 16, row: ROW }, { col: 30, row: ROW })!
  assert.equal(b.length, a.length)
})

test('a target standing in a wall is approached to the nearest free tile, and a closed-off one gives null', () => {
  const wall = findSolidNextToFloor(open)
  assert.ok(isTileBlocked(open, wall.col, wall.row))
  assert.equal(findPath(open, { col: 16, row: ROW }, wall), null, 'findPath alone cannot go there')
  const p = findPathToward(open, { col: 16, row: ROW }, wall, 1)!
  assert.ok(p, 'but we can get next to it')
  const last = p.at(-1) ?? { x: (16 + 0.5) * TILE, y: (ROW + 0.5) * TILE }
  assert.ok(Math.max(Math.abs(Math.floor(last.x / TILE) - wall.col), Math.abs(Math.floor(last.y / TILE) - wall.row)) <= 1)

  // a target boxed in by solid props on all 8 sides can be seen but not reached
  const target = { col: 16, row: ROW }
  const boxed: WorldMap = {
    ...open,
    props: [
      { type: 'x', col: 15, row: ROW - 1, w: 3, h: 1, solid: true },
      { type: 'x', col: 15, row: ROW, w: 1, h: 1, solid: true },
      { type: 'x', col: 17, row: ROW, w: 1, h: 1, solid: true },
      { type: 'x', col: 15, row: ROW + 1, w: 3, h: 1, solid: true },
    ],
  }
  assert.equal(findPathToward(boxed, { col: 30, row: ROW }, target), null)
})

function findSolidNextToFloor(map: WorldMap): { col: number; row: number } {
  for (let r = 1; r < map.rows - 1; r++) {
    for (let c = 1; c < map.cols - 1; c++) {
      if (isTileBlocked(map, c, r) && findPathToward(map, { col: 16, row: ROW }, { col: c, row: r }, 1)) return { col: c, row: r }
    }
  }
  throw new Error('no solid tile in this map')
}

// ---------------------------------------------------------------- the real engine, following

/** An engine for `me` at (col,row), already following `leader`, who stands at (lc,lr). */
function followSetup(me: { col: number; row: number }, leaderAt: { col: number; row: number }) {
  const h = makeEngine(open, me)
  h.session.attach(
    () => {},
    undefined,
    undefined,
    () => true,
  )
  h.placeRemote('leader', leaderAt.col, leaderAt.row)
  h.step(2) // creates the remote character
  assert.equal(h.session.follow.request('leader'), 'sent')
  h.session.onRemoteFollow('leader', 'accept')
  assert.equal(h.session.follow.snapshot.following, 'leader')
  return h
}

const distToLeader = (h: ReturnType<typeof makeEngine>) => {
  const l = h.session.remotes.get('leader')!
  return Math.hypot(l.x - h.e.player.x / TILE, l.y - h.e.player.y / TILE)
}

test('a follower walks to the leader and stops a little way off, not on top of them', () => {
  const h = followSetup({ col: 16, row: ROW }, { col: 34, row: ROW })
  try {
    h.step(60 * 8)
    const d = distToLeader(h)
    assert.ok(d <= 2.5 + 0.2, `ended up ${d.toFixed(2)} tiles away`)
    assert.ok(d >= 1.0, `stood ${d.toFixed(2)} tiles away: right on top of them`)
    assert.equal(h.e.player.moving, false, 'and stopped')
  } finally {
    h.close()
  }
})

test('the follower keeps up as the leader walks away, and stays put while the leader stands still', () => {
  const h = followSetup({ col: 16, row: ROW }, { col: 20, row: ROW })
  try {
    h.step(60 * 3)
    const settled = { x: h.e.player.x, y: h.e.player.y }
    h.step(60 * 2)
    assert.deepEqual({ x: h.e.player.x, y: h.e.player.y }, settled, 'no twitching while nothing changes')

    // the leader walks 20 tiles down the walkway, one tile at a time, like position updates do
    for (let col = 21; col <= 40; col++) {
      h.placeRemote('leader', col, ROW)
      h.step(12)
    }
    h.step(60 * 4)
    assert.ok(distToLeader(h) <= 2.5 + 0.2, `fell behind by ${distToLeader(h).toFixed(2)} tiles`)
    assert.ok(h.e.player.x / TILE > 30, 'and actually travelled')
  } finally {
    h.close()
  }
})

test('pressing a key takes over and only pauses: the follower stays put until resumed, with the leader’s yes intact', () => {
  const h = followSetup({ col: 16, row: ROW }, { col: 40, row: ROW })
  try {
    h.step(60)
    const x0 = h.e.player.x
    assert.ok(x0 > 16.5 * TILE, 'it was on its way')

    h.hold('w', 5)
    assert.equal(h.session.follow.snapshot.paused, true)
    assert.equal(h.session.follow.snapshot.following, 'leader', 'still allowed to follow')
    h.step(60)
    const parked = h.e.player.x
    h.step(60)
    assert.equal(h.e.player.x, parked, 'and not walking after them')

    h.session.follow.resume()
    h.step(60)
    assert.ok(h.e.player.x > parked + TILE, 'walking again')
  } finally {
    h.close()
  }
})

test('choosing a destination by hand (a click or the minimap) also pauses it; stopping follows nobody', () => {
  const h = followSetup({ col: 16, row: ROW }, { col: 40, row: ROW })
  try {
    h.e.walkToTile(18, ROW)
    assert.equal(h.session.follow.snapshot.paused, true)
    h.step(60 * 2)
    assert.equal(h.tile().col, 18, 'went where I said, not after the leader')

    h.session.follow.stopFollowing()
    h.session.follow.resume()
    h.step(60)
    assert.equal(h.tile().col, 18, 'no longer following anyone')
  } finally {
    h.close()
  }
})

test('a leader who left the room, or has not been heard from yet, leaves the follower where it stands', () => {
  const h = makeEngine(open, { col: 20, row: ROW })
  try {
    h.session.attach(() => {}, undefined, undefined, () => true)
    h.session.follow.request('ghost')
    h.session.onRemoteFollow('ghost', 'accept')
    h.step(60) // no position for them: nothing to walk to, and no crash
    assert.equal(h.tile().col, 20)

    h.placeRemote('ghost', 30, ROW)
    h.step(30)
    h.session.onPeerLeft('ghost')
    assert.equal(h.session.follow.snapshot.following, null)
    const x = h.e.player.x
    h.step(60)
    assert.equal(h.e.player.x, x)
  } finally {
    h.close()
  }
})

test('stopping or being removed mid-walk halts the follower at once instead of finishing the old route', () => {
  for (const end of ['I stop', 'they remove me'] as const) {
    const h = followSetup({ col: 16, row: ROW }, { col: 44, row: ROW })
    try {
      h.step(45)
      const x = h.e.player.x
      assert.ok(x > 16.5 * TILE && h.e.player.moving, 'on its way')
      if (end === 'I stop') h.session.follow.stopFollowing()
      else h.session.onRemoteFollow('leader', 'stop')
      h.step(2)
      const parked = h.e.player.x
      h.step(90)
      assert.ok(Math.abs(h.e.player.x - parked) < 1, `${end}: kept walking`)
    } finally {
      h.close()
    }
  }
})

test('a leader standing inside a wall is approached, not walked into, and the engine does not hang', () => {
  const wall = findSolidNextToFloor(open)
  const h = followSetup({ col: 16, row: ROW }, { col: 30, row: ROW })
  try {
    h.placeRemote('leader', wall.col, wall.row)
    h.step(60 * 20)
    const t = h.tile()
    assert.ok(!isTileBlocked(open, t.col, t.row), 'never ended up inside the wall')
    assert.ok(distToLeader(h) < 6, `got near them (${distToLeader(h).toFixed(1)} tiles)`)
  } finally {
    h.close()
  }
})

test('the follower draws its dotted link without throwing, with the leader on screen, paused, and gone', () => {
  const h = followSetup({ col: 16, row: ROW }, { col: 20, row: ROW })
  try {
    h.step(30)
    h.draw()
    h.session.follow.pause()
    h.draw()
    h.session.onPeerLeft('leader')
    h.draw()
  } finally {
    h.close()
  }
})

// ---------------------------------------------------------------- clicking a character

test('a click on a person’s body opens their menu instead of walking to them; elsewhere it still walks', () => {
  const h = makeEngine(open, { col: 20, row: ROW })
  const clicks: { id: string; x: number; y: number }[] = []
  ;(h.e as unknown as { opts: { onCharacterClick?: (id: string, x: number, y: number) => void } }).opts.onCharacterClick = (id, x, y) => clicks.push({ id, x, y })
  try {
    h.placeRemote('nora', 24, ROW)
    h.step(2)
    h.draw() // sets the camera, so screen -> world is right
    const nora = h.e.remote.get('nora')!
    const screen = (wx: number, wy: number) => ({
      x: (wx - h.e.view.x) * h.e.zoom + h.e.cssW / 2,
      y: (wy - h.e.view.y) * h.e.zoom + h.e.cssH / 2,
    })
    const press = (wx: number, wy: number) => (h.e as unknown as { pressCharacter(x: number, y: number): boolean }).pressCharacter(screen(wx, wy).x, screen(wx, wy).y)

    assert.equal(press(nora.x, nora.y - 20), true, 'on the body')
    assert.equal(press(nora.x, nora.y - 40), true, 'on the head')
    assert.equal(press(nora.x + 60, nora.y), false, 'beside them')
    assert.equal(press(nora.x, nora.y + 60), false, 'well below their feet')
    assert.equal(press(nora.x, nora.y - 120), false, 'well above their head')
    assert.deepEqual(clicks.map((c) => c.id), ['nora', 'nora'])
  } finally {
    h.close()
  }
})

test('when two people overlap, the one in front (lower on screen) is the one you click', () => {
  const h = makeEngine(open, { col: 20, row: ROW })
  const clicks: string[] = []
  ;(h.e as unknown as { opts: { onCharacterClick?: (id: string) => void } }).opts.onCharacterClick = (id) => clicks.push(id)
  try {
    h.placeRemote('back', 24, ROW)
    h.placeRemote('front', 24, ROW + 1)
    h.step(2)
    h.draw()
    const front = h.e.remote.get('front')!
    const sx = (front.x - h.e.view.x) * h.e.zoom + h.e.cssW / 2
    const sy = (front.y - 30 - h.e.view.y) * h.e.zoom + h.e.cssH / 2
    ;(h.e as unknown as { pressCharacter(x: number, y: number): boolean }).pressCharacter(sx, sy)
    assert.deepEqual(clicks, ['front'])
  } finally {
    h.close()
  }
})
