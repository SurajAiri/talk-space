import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { ProximityMixer } from '../src/world/ProximityMixer.ts'

/** Just enough Web Audio to see where each voice is routed and what the master volume is set to. */
class FakeGain {
  target = NaN
  gain = {
    value: 1,
    setTargetAtTime: (v: number) => {
      this.target = v
    },
  }
  out: unknown = null
  connect(n: unknown) {
    this.out = n
    return n
  }
  disconnect() {
    this.out = null
  }
}
class FakeSource {
  out: unknown = null
  connect(n: unknown) {
    this.out = n
    return n
  }
  disconnect() {}
}
class FakeContext {
  currentTime = 0
  state = 'running'
  destination = { kind: 'destination' }
  gains: FakeGain[] = []
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createMediaStreamSource() {
    return new FakeSource()
  }
  resume() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
}
class FakeAudio {
  srcObject: unknown = null
  muted = false
  play() {
    return Promise.resolve()
  }
  pause() {}
}

let ctx: FakeContext
const g = globalThis as unknown as Record<string, unknown>
beforeEach(() => {
  g.AudioContext = function () {
    ctx = new FakeContext()
    return ctx
  }
  g.Audio = FakeAudio
})
afterEach(() => {
  delete g.AudioContext
  delete g.Audio
})

const stream = {} as MediaStream

test('every voice is routed through one master gain, which "sound off" sets to 0 and back to 1', () => {
  const m = new ProximityMixer()
  m.attach('a', stream)
  const [master] = ctx.gains
  assert.ok(master)
  assert.equal(master.out, ctx.destination, 'master is what reaches the speakers')
  assert.equal(ctx.gains[1]!.out, master, "a person's voice goes into the master, not straight out")

  m.setDeafened(true)
  assert.equal(master.target, 0)
  m.setDeafened(false)
  assert.equal(master.target, 1)
})

test('sound off survives voices arriving and leaving, and voices keep their own volume underneath', () => {
  const m = new ProximityMixer()
  m.attach('a', stream)
  m.setDeafened(true)
  m.attach('b', {} as MediaStream) // someone joins while sound is off
  m.setGain('b', 0.7) // walking closer still updates their own level
  const master = ctx.gains[0]!
  assert.equal(master.target, 0, 'still silent')
  assert.equal(ctx.gains[2]!.target, 0.7, "their personal volume is kept, ready for when sound is back")
  m.detach('a')
  assert.equal(master.target, 0)
  m.setDeafened(false)
  assert.equal(master.target, 1)
})

test('choosing sound off before any audio exists still applies once the audio context is created', () => {
  const m = new ProximityMixer()
  m.setDeafened(true) // no context yet
  m.attach('a', stream)
  assert.equal(ctx.gains[0]!.gain.value, 0, 'the master starts silent, so nothing leaks before the first update')
})
