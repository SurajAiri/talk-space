/** Run: pnpm --filter web test   (no browser: RTCPeerConnection is replaced by a fake) */
import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'
import {
  candidateTypeOf,
  candidateTypesInSdp,
  diagnoseIce,
  emptyCounts,
  hasIceServer,
  type IceReport,
  type LinkProblem,
} from '../src/webrtc/diagnose.ts'
import { NetworkManager } from '../src/webrtc/NetworkManager.ts'
import { PeerLink, type Link, type PeerLinkOptions } from '../src/webrtc/PeerLink.ts'

// ------------------------------------------------------------------ pure diagnosis

const report = (over: Partial<IceReport> & { local?: Partial<IceReport['local']>; remote?: Partial<IceReport['remote']> } = {}): IceReport => ({
  stunConfigured: true,
  turnConfigured: false,
  relayOnly: false,
  serverErrors: [],
  ...over,
  local: { ...emptyCounts(), host: 1, srflx: 1, ...over.local },
  remote: { ...emptyCounts(), host: 1, srflx: 1, ...over.remote },
})

test('candidate type is read from candidate lines and SDP, and nothing else', () => {
  assert.equal(candidateTypeOf('candidate:1 1 udp 2113937151 192.168.1.5 5000 typ host generation 0'), 'host')
  assert.equal(candidateTypeOf('candidate:2 1 udp 1677729535 203.0.113.7 56143 typ srflx raddr 0.0.0.0 rport 0'), 'srflx')
  assert.equal(candidateTypeOf('candidate:3 1 udp 41885439 198.51.100.9 60000 typ relay raddr 0.0.0.0 rport 0'), 'relay')
  assert.equal(candidateTypeOf('typhoon'), null)
  assert.equal(candidateTypeOf(''), null)
  assert.equal(candidateTypeOf(undefined), null)

  const sdp = ['v=0', 'a=candidate:1 1 udp 1 10.0.0.2 1 typ host', 'a=ice-ufrag:x', 'a=candidate:2 1 udp 1 1.2.3.4 2 typ srflx'].join('\r\n')
  assert.deepEqual(candidateTypesInSdp(sdp), ['host', 'srflx'])
  assert.deepEqual(candidateTypesInSdp(undefined), [])
})

test('hasIceServer understands string/array urls and the secure schemes', () => {
  assert.equal(hasIceServer([{ urls: 'stun:a:1' }], 'stun'), true)
  assert.equal(hasIceServer([{ urls: 'stun:a:1' }], 'turn'), false)
  assert.equal(hasIceServer([{ urls: ['stun:a', 'turn:b?transport=tcp'] }], 'turn'), true)
  assert.equal(hasIceServer([{ urls: 'turns:b:443' }], 'turn'), true)
  assert.equal(hasIceServer([], 'stun'), false)
})

test('nothing ever came from the other side: it is NOT a NAT problem, and must not be reported as one', () => {
  const p = diagnoseIce(report({ remote: { host: 0, srflx: 0 } }))
  assert.equal(p.code, 'no-remote-candidates')
})

test('no TURN configured and direct paths failed (the usual symmetric / carrier-grade NAT case)', () => {
  assert.equal(diagnoseIce(report()).code, 'needs-relay')
})

test('STUN unreachable (UDP blocked) is told apart from a NAT that merely refuses direct paths', () => {
  const p = diagnoseIce(report({ local: { srflx: 0 } }))
  assert.equal(p.code, 'stun-blocked')
  // with STUN not configured at all we cannot blame the network for missing srflx
  assert.equal(diagnoseIce(report({ stunConfigured: false, local: { srflx: 0 } })).code, 'needs-relay')
})

test('TURN is configured but gave us no relay address: credentials, ports or blocked UDP', () => {
  const p = diagnoseIce(
    report({ turnConfigured: true, serverErrors: [{ url: 'turn:t:3478', code: 401, text: 'Unauthorized' }] }),
  )
  assert.equal(p.code, 'turn-failed')
  assert.match(p.hint, /401 Unauthorized/)
})

test('relay-only mode without a relay candidate is its own, explicit failure', () => {
  assert.equal(diagnoseIce(report({ relayOnly: true, turnConfigured: true })).code, 'relay-unreachable')
})

test('a relay candidate exists and it still failed: say so rather than blaming TURN setup', () => {
  assert.equal(diagnoseIce(report({ turnConfigured: true, local: { relay: 1 } })).code, 'relay-failed')
})

// ------------------------------------------------------------------ PeerLink: evidence + timing

class FakeChannel {
  onopen: unknown = null
  onmessage: unknown = null
  close() {}
}
class FakePC {
  signalingState = 'stable'
  connectionState = 'new'
  iceConnectionState = 'new'
  localDescription: { type: string; sdp: string } | null = null
  ontrack: unknown = null
  onicecandidate: ((e: { candidate: unknown }) => void) | null = null
  onicecandidateerror: unknown = null
  onnegotiationneeded: unknown = null
  oniceconnectionstatechange: (() => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  restarts = 0
  createDataChannel() {
    return new FakeChannel()
  }
  addTransceiver() {
    return { direction: 'sendrecv', sender: { replaceTrack: () => Promise.resolve() }, receiver: { track: { kind: 'audio' } } }
  }
  getTransceivers() {
    return []
  }
  setRemoteDescription() {
    return Promise.resolve()
  }
  setLocalDescription() {
    return Promise.resolve()
  }
  addIceCandidate() {
    return Promise.resolve()
  }
  restartIce() {
    this.restarts++
  }
  close() {}
}
class FakeMediaStream {
  getTracks() {
    return []
  }
  addTrack() {}
}

let pc: FakePC
const g = globalThis as unknown as Record<string, unknown>
beforeEach(() => {
  g.RTCPeerConnection = function () {
    pc = new FakePC()
    return pc
  }
  g.MediaStream = FakeMediaStream
  mock.method(console, 'warn', () => {}) // failures are logged on purpose; keep test output clean
})
afterEach(() => {
  mock.restoreAll()
  delete g.RTCPeerConnection
  delete g.MediaStream
})

const settle = () => new Promise<void>((r) => setImmediate(r))
const cand = (type: string) => ({
  type,
  candidate: `candidate:1 1 udp 1 1.2.3.4 5 typ ${type}`,
  toJSON() {
    return { candidate: this.candidate, sdpMid: '0', sdpMLineIndex: 0 }
  },
})

function makeLink(over: Partial<PeerLinkOptions> = {}) {
  const problems: LinkProblem[] = []
  const l = new PeerLink({
    selfId: 'b',
    remoteId: 'a',
    initiator: true,
    iceServers: [{ urls: 'stun:stun.example:19302' }],
    localAudioTrack: null,
    sendSignal: () => {},
    onState: () => {},
    onProblem: (p) => problems.push(p),
    onStream: () => {},
    onData: () => {},
    onOpen: () => {},
    ...over,
  })
  return { l, problems }
}
const iceFails = () => {
  pc.iceConnectionState = 'failed'
  pc.oniceconnectionstatechange?.()
}

test('ICE failing is diagnosed AT ONCE, not after the 48 s watchdog and three redials', async () => {
  const { l, problems } = makeLink()
  pc.onicecandidate!({ candidate: cand('host') })
  pc.onicecandidate!({ candidate: cand('srflx') })
  l.handleSignal({ candidate: { candidate: 'candidate:9 1 udp 1 9.9.9.9 9 typ srflx' } })
  await settle()

  iceFails()
  assert.equal(problems.length, 1)
  assert.equal(problems[0]!.code, 'needs-relay', 'both sides had addresses, nothing worked, and no TURN exists')
  assert.equal(pc.restarts, 1, 'the existing ICE-restart behaviour is untouched')
  l.close()
})

test('an unreachable STUN server (no srflx gathered) is reported as such', async () => {
  const { l, problems } = makeLink()
  pc.onicecandidate!({ candidate: cand('host') })
  l.handleSignal({ candidate: { candidate: 'candidate:9 1 udp 1 9.9.9.9 9 typ host' } })
  await settle()
  iceFails()
  assert.equal(problems[0]!.code, 'stun-blocked')
  l.close()
})

test('if no candidate ever arrives from the peer, that (not NAT) is what we report', async () => {
  const { l, problems } = makeLink()
  pc.onicecandidate!({ candidate: cand('host') })
  pc.onicecandidate!({ candidate: cand('srflx') })
  iceFails()
  assert.equal(problems[0]!.code, 'no-remote-candidates')
  l.close()
})

test('candidates inside a received SDP count as evidence too', async () => {
  const { l, problems } = makeLink()
  pc.onicecandidate!({ candidate: cand('host') })
  pc.onicecandidate!({ candidate: cand('srflx') })
  l.handleSignal({ description: { type: 'answer', sdp: 'v=0\r\na=candidate:1 1 udp 1 1.1.1.1 1 typ srflx\r\n' } })
  await settle()
  iceFails()
  assert.equal(problems[0]!.code, 'needs-relay')
  l.close()
})

test('the same diagnosis is not repeated on every ICE restart, but is re-reported after a success', async () => {
  const { l, problems } = makeLink()
  pc.onicecandidate!({ candidate: cand('host') })
  pc.onicecandidate!({ candidate: cand('srflx') })
  l.handleSignal({ candidate: { candidate: 'candidate:9 1 udp 1 9.9.9.9 9 typ srflx' } })
  await settle()

  iceFails()
  iceFails()
  assert.equal(problems.length, 1, 'no spam')

  pc.connectionState = 'connected'
  pc.onconnectionstatechange!()
  iceFails()
  assert.equal(problems.length, 2, 'a link that worked and later fails again is news')
  l.close()
})

test('a closed link says nothing', async () => {
  const { l, problems } = makeLink()
  l.close()
  iceFails()
  assert.equal(problems.length, 0)
})

test('with TURN configured but no relay candidate, the hint points at TURN, not at the user\'s network', async () => {
  const { l, problems } = makeLink({ iceServers: [{ urls: ['stun:s', 'turn:t:3478'], username: 'u', credential: 'c' }] })
  pc.onicecandidate!({ candidate: cand('host') })
  pc.onicecandidate!({ candidate: cand('srflx') })
  l.handleSignal({ candidate: { candidate: 'candidate:9 1 udp 1 9.9.9.9 9 typ srflx' } })
  await settle()
  iceFails()
  assert.equal(problems[0]!.code, 'turn-failed')
  l.close()
})

// ------------------------------------------------------------------ NetworkManager plumbing

test('a problem reaches the owner, and one from a replaced link never does', () => {
  const links: { opts: PeerLinkOptions; closed: boolean }[] = []
  const seen: [string, string][] = []
  const mgr = new NetworkManager({
    selfId: 'self',
    socket: { on() {}, off() {}, emit() {} } as never,
    iceServers: [],
    chatMax: 100,
    handlers: {
      onPeerState: () => {},
      onPeerStream: () => {},
      onPeerMessage: () => {},
      onPeerProblem: (id, p) => seen.push([id, p.code]),
    },
    linkFactory: (o) => {
      const l = {
        opts: o,
        closed: false,
        remoteId: o.remoteId,
        handleSignal() {},
        send: () => false,
        sendUnreliable: () => false,
        setLocalTrack() {},
        setAudioEnabled() {},
        close() {
          this.closed = true
        },
      }
      links.push(l)
      return l as unknown as Link
    },
  })

  const problem: LinkProblem = { code: 'needs-relay', message: 'm', hint: 'h' }
  mgr.connect('p1', true)
  const old = links[0]!
  old.opts.onProblem?.(problem)
  assert.deepEqual(seen, [['p1', 'needs-relay']])

  mgr.connect('p1', true) // the peer re-joined: a fresh link replaces the old one
  old.opts.onProblem?.(problem)
  assert.equal(seen.length, 1, 'the stale link is muted')
  links[1]!.opts.onProblem?.(problem)
  assert.equal(seen.length, 2)
  mgr.close()
})
