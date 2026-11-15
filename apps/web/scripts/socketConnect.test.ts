import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import type { Socket } from 'socket.io-client'
import {
  createManualReconnect,
  describeConnectFailure,
  isFatalConnectError,
  MAX_MANUAL_RETRIES,
  manualRetryDelayMs,
  waitForFirstConnect,
} from '../src/lib/socketConnect.ts'

/** Just enough of a socket.io Socket: events, disconnect(), connect(). */
class FakeSocket extends EventEmitter {
  connected = false
  disconnectCalls = 0
  connectCalls = 0
  disconnect() {
    this.disconnectCalls++
  }
  connect() {
    this.connectCalls++
  }
}
const asSocket = (s: FakeSocket) => s as unknown as Socket
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('waitForFirstConnect resolves on connect and leaves no listeners behind', async () => {
  const s = new FakeSocket()
  const p = waitForFirstConnect(asSocket(s))
  s.emit('connect')
  assert.equal(await p, s as unknown)
  assert.equal(s.listenerCount('connect'), 0)
  assert.equal(s.listenerCount('connect_error'), 0)
})

test('REGRESSION: a connect_error AFTER the first connect must not close the socket', async () => {
  // This is the "Reconnecting… forever" bug: the leftover listener closed the socket on the first
  // failed reconnect attempt, which cancels socket.io's own retrying.
  const s = new FakeSocket()
  const p = waitForFirstConnect(asSocket(s))
  s.emit('connect')
  await p
  s.emit('connect_error', new Error('websocket error')) // a failed reconnect attempt
  assert.equal(s.disconnectCalls, 0)
})

test('waitForFirstConnect rejects on the first connect_error, closes the socket, and cleans up', async () => {
  const s = new FakeSocket()
  const p = waitForFirstConnect(asSocket(s))
  const err = new Error('UNAUTHORIZED')
  s.emit('connect_error', err)
  await assert.rejects(p, err)
  assert.equal(s.disconnectCalls, 1)
  assert.equal(s.listenerCount('connect'), 0)
})

test('manual reconnect: calls connect() after the pause while still waiting', async () => {
  const s = new FakeSocket()
  const r = createManualReconnect({ socket: s, isWaiting: () => true, giveUp: () => assert.fail('gave up'), delayMs: () => 5 })
  r.schedule('refused')
  r.schedule('refused') // a second request while one is pending is a no-op
  await sleep(40)
  assert.equal(s.connectCalls, 1)
})

test('manual reconnect: does nothing if we are no longer waiting, or already connected', async () => {
  const s = new FakeSocket()
  let waiting = true
  const r = createManualReconnect({ socket: s, isWaiting: () => waiting, giveUp: () => {}, delayMs: () => 5 })
  r.schedule('x')
  waiting = false // e.g. the person left the room meanwhile
  await sleep(30)
  assert.equal(s.connectCalls, 0)

  waiting = true
  s.connected = true
  r.schedule('x')
  await sleep(30)
  assert.equal(s.connectCalls, 0)
})

test('manual reconnect: gives up after the maximum tries, with the reason', async () => {
  const s = new FakeSocket()
  const gaveUp: string[] = []
  const r = createManualReconnect({ socket: s, isWaiting: () => true, giveUp: (w) => gaveUp.push(w), maxRetries: 3, delayMs: () => 1 })
  for (let i = 0; i < 3; i++) {
    r.schedule('UNAUTHORIZED')
    await sleep(15)
  }
  assert.equal(s.connectCalls, 3)
  assert.deepEqual(gaveUp, [])
  r.schedule('UNAUTHORIZED') // the 4th request: out of tries
  assert.deepEqual(gaveUp, ['UNAUTHORIZED'])
  assert.equal(s.connectCalls, 3)
})

test('manual reconnect: reset() cancels a pending try and restores the budget', async () => {
  const s = new FakeSocket()
  const gaveUp: string[] = []
  const r = createManualReconnect({ socket: s, isWaiting: () => true, giveUp: (w) => gaveUp.push(w), maxRetries: 1, delayMs: () => 10 })
  r.schedule('x')
  r.reset() // connected again (or session over) before the timer fired
  await sleep(40)
  assert.equal(s.connectCalls, 0)
  r.schedule('x') // budget is back
  await sleep(40)
  assert.equal(s.connectCalls, 1)
  assert.deepEqual(gaveUp, [])
})

test('retry pauses grow, then stay at 15s; the whole budget is under a minute', () => {
  const pauses = Array.from({ length: MAX_MANUAL_RETRIES }, (_, i) => manualRetryDelayMs(i))
  assert.deepEqual(pauses, [1000, 2000, 4000, 8000, 15000, 15000])
  assert.ok(pauses.reduce((a, b) => a + b, 0) < 60_000)
})

test('only account blocks are fatal; UNAUTHORIZED may be a passing server problem', () => {
  assert.equal(isFatalConnectError(new Error('ACCOUNT_SUSPENDED')), true)
  assert.equal(isFatalConnectError(new Error('UNAUTHORIZED')), false)
  assert.equal(isFatalConnectError(new Error('websocket error')), false)
})

test('the give-up message never shows a raw error code', () => {
  const raw = ['UNAUTHORIZED', 'UNAVAILABLE', 'websocket error', 'io server disconnect']
  for (const why of raw) {
    const text = describeConnectFailure(why)
    for (const code of raw) assert.ok(!text.includes(code), `"${text}" leaks "${code}"`)
    assert.ok(text.endsWith('.'))
  }
  assert.match(describeConnectFailure('UNAUTHORIZED'), /sign-in/)
  assert.match(describeConnectFailure('UNAVAILABLE'), /trouble/)
  assert.match(describeConnectFailure('websocket error'), /could not be reached/)
})
