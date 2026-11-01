import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { PeerLink, type PeerLinkOptions } from '../src/webrtc/PeerLink.ts'
import type { SignalData } from '../src/webrtc/types.ts'

/**
 * A stand-in for RTCPeerConnection that follows the one JSEP rule these tests are about: an incoming
 * offer gets its own audio transceiver (recvonly from our side), and a transceiver we made ourselves
 * with addTransceiver() is NOT matched to it (only addTrack-created ones are).
 */
class FakeTransceiver {
  direction: string
  readonly sentTracks: (MediaStreamTrack | null)[] = []
  readonly sender = {
    replaceTrack: (t: MediaStreamTrack | null) => {
      this.sentTracks.push(t)
      return Promise.resolve()
    },
  }
  readonly receiver: { track: { kind: string } }
  constructor(kind: string, direction: string) {
    this.direction = direction
    this.receiver = { track: { kind } }
  }
}
class FakeChannel {
  onopen: unknown = null
  onmessage: unknown = null
  close() {}
}
class FakePC {
  transceivers: FakeTransceiver[] = []
  addTransceiverCalls = 0
  signalingState = 'stable'
  connectionState = 'new'
  iceConnectionState = 'new'
  localDescription: { type: string; sdp: string } | null = null
  ontrack: unknown = null
  onicecandidate: unknown = null
  onnegotiationneeded: unknown = null
  oniceconnectionstatechange: unknown = null
  onconnectionstatechange: unknown = null
  createDataChannel() {
    return new FakeChannel()
  }
  addTransceiver(kind: string, init: { direction: string }) {
    this.addTransceiverCalls++
    const t = new FakeTransceiver(kind, init.direction)
    this.transceivers.push(t)
    return t
  }
  getTransceivers() {
    return this.transceivers
  }
  setRemoteDescription(d: { type: string }) {
    if (d.type === 'offer') {
      this.transceivers.push(new FakeTransceiver('audio', 'recvonly')) // the offer's m-line, with its own transceiver
      this.signalingState = 'have-remote-offer'
    } else this.signalingState = 'stable'
    return Promise.resolve()
  }
  setLocalDescription() {
    const type = this.signalingState === 'have-remote-offer' ? 'answer' : 'offer'
    this.localDescription = { type, sdp: this.transceivers.map((t) => t.direction).join(',') }
    this.signalingState = type === 'offer' ? 'have-local-offer' : 'stable'
    return Promise.resolve()
  }
  addIceCandidate() {
    return Promise.resolve()
  }
  restartIce() {}
  close() {}
}
class FakeMediaStream {
  private tracks: unknown[] = []
  getTracks() {
    return this.tracks
  }
  addTrack(t: unknown) {
    this.tracks.push(t)
  }
}

let pc: FakePC
const g = globalThis as unknown as Record<string, unknown>
beforeEach(() => {
  g.RTCPeerConnection = function () {
    pc = new FakePC()
    return pc
  }
  g.MediaStream = FakeMediaStream
})
afterEach(() => {
  delete g.RTCPeerConnection
  delete g.MediaStream
})

const track = { kind: 'audio', id: 'mine' } as unknown as MediaStreamTrack
const settle = () => new Promise<void>((r) => setImmediate(r)) // let the link's signal queue drain

function link(over: Partial<PeerLinkOptions> = {}) {
  const sent: SignalData[] = []
  const l = new PeerLink({
    selfId: 'b',
    remoteId: 'a',
    initiator: false,
    iceServers: [],
    localAudioTrack: track,
    sendSignal: (_to, data) => sent.push(data),
    onState: () => {},
    onStream: () => {},
    onData: () => {},
    onOpen: () => {},
    ...over,
  })
  return { l, sent }
}

test('the offering side creates the audio transceiver itself', () => {
  const { l } = link({ initiator: true })
  assert.equal(pc.addTransceiverCalls, 1)
  assert.equal(pc.transceivers[0]!.direction, 'sendrecv')
  l.close()
})

test('the answering side creates none of its own, so the offer cannot leave it with a stray second one', async () => {
  const { l, sent } = link({ initiator: false })
  assert.equal(pc.addTransceiverCalls, 0, 'it waits for the offer instead')

  l.handleSignal({ description: { type: 'offer', sdp: 'offer' } })
  await settle()

  assert.equal(pc.transceivers.length, 1, 'exactly one audio transceiver: the one the offer brought')
  assert.equal(pc.transceivers[0]!.direction, 'sendrecv', 'adopted, and answered as two-way')
  const answer = sent.find((s) => s.description?.type === 'answer')
  assert.ok(answer, 'an answer went back')
  assert.match(answer.description!.sdp ?? '', /sendrecv/, 'the answer offers our voice too')
  l.close()
})

test('the adopted transceiver sends our microphone, and later offers do not adopt it again', async () => {
  const { l } = link({ initiator: false })
  l.handleSignal({ description: { type: 'offer', sdp: 'offer' } })
  await settle()
  assert.equal(pc.transceivers[0]!.sentTracks.at(-1), track, 'our voice flows as soon as it is negotiated')

  const callsBefore = pc.transceivers[0]!.sentTracks.length
  pc.signalingState = 'stable'
  l.handleSignal({ description: { type: 'offer', sdp: 'renegotiate' } }) // e.g. an ICE restart
  await settle()
  assert.equal(pc.transceivers.length, 2, 'the fake adds a second m-line for it; the link must not touch ours again')
  assert.equal(pc.transceivers[0]!.sentTracks.length, callsBefore, 'already adopted: nothing is re-applied')
  l.close()
})

test('turning our voice off for this peer before the offer arrives is remembered and applied once it does', async () => {
  const { l } = link({ initiator: false })
  assert.doesNotThrow(() => l.setAudioEnabled(false), 'no transceiver yet must not be an error')
  assert.equal(pc.transceivers.length, 0)

  l.handleSignal({ description: { type: 'offer', sdp: 'offer' } })
  await settle()
  assert.equal(pc.transceivers[0]!.sentTracks.at(-1), null, 'still off after negotiating: it must not start sending')
  l.close()
})

test('changing the microphone track before negotiation is also safe on the answering side', async () => {
  const { l } = link({ initiator: false, localAudioTrack: null })
  l.handleSignal({ description: { type: 'offer', sdp: 'offer' } })
  await settle()
  assert.equal(pc.transceivers[0]!.sentTracks.at(-1), null)
  l.setLocalTrack(track)
  await settle()
  assert.equal(pc.transceivers[0]!.sentTracks.at(-1), track)
  l.close()
})
