/**
 * Why a peer-to-peer link failed, worked out from evidence the browser already has: which kinds of
 * network addresses ("candidates") each side managed to produce.
 *
 *   host   the device's own address (LAN). Enough only when both sides share a network.
 *   srflx  the public address a STUN server saw. Enough only when both NATs are friendly.
 *   relay  an address on a TURN server. Works through almost anything; needs a TURN server.
 *
 * Without this, every failure looks the same ("Connecting…" for minutes). With it, the person
 * (and you, reading the console) can tell "your network blocks UDP" from "no TURN server is
 * configured" from "the other browser never sent anything".
 */

export type CandidateType = 'host' | 'srflx' | 'prflx' | 'relay'

export type CandidateCounts = Record<CandidateType, number>

export const emptyCounts = (): CandidateCounts => ({ host: 0, srflx: 0, prflx: 0, relay: 0 })

export interface IceReport {
  /** candidates our browser gathered */
  local: CandidateCounts
  /** candidates that arrived from the other side */
  remote: CandidateCounts
  /** STUN/TURN lookups our browser reported as failed (noisy: one per unreachable interface) */
  serverErrors: { url: string; code: number; text: string }[]
  stunConfigured: boolean
  turnConfigured: boolean
  /** iceTransportPolicy === 'relay' */
  relayOnly: boolean
}

export type ProblemCode =
  | 'no-remote-candidates'
  | 'relay-unreachable'
  | 'turn-failed'
  | 'stun-blocked'
  | 'needs-relay'
  | 'relay-failed'

export interface LinkProblem {
  code: ProblemCode
  /** short, for the participant list */
  message: string
  /** longer, for the console and for whoever runs the server */
  hint: string
}

const TYPE_RE = /\btyp (host|srflx|prflx|relay)\b/

/** `candidate:842163049 1 udp 1677729535 203.0.113.7 56143 typ srflx raddr ...` -> 'srflx' */
export function candidateTypeOf(candidate: string | undefined | null): CandidateType | null {
  const m = candidate ? TYPE_RE.exec(candidate) : null
  return (m?.[1] as CandidateType | undefined) ?? null
}

/** Every `a=candidate:` line in an SDP (some browsers embed already-gathered candidates in it). */
export function candidateTypesInSdp(sdp: string | undefined | null): CandidateType[] {
  if (!sdp) return []
  const out: CandidateType[] = []
  for (const line of sdp.split(/\r?\n/)) {
    if (!line.startsWith('a=candidate:')) continue
    const t = candidateTypeOf(line)
    if (t) out.push(t)
  }
  return out
}

const urlsOf = (s: { urls: string | string[] }) => (Array.isArray(s.urls) ? s.urls : [s.urls])

/** Does this ICE server list contain a server of the given kind? */
export function hasIceServer(servers: readonly { urls: string | string[] }[], kind: 'stun' | 'turn'): boolean {
  return servers.some((s) => urlsOf(s).some((u) => u.startsWith(`${kind}:`) || u.startsWith(`${kind}s:`)))
}

export function diagnoseIce(r: IceReport): LinkProblem {
  const remoteTotal = r.remote.host + r.remote.srflx + r.remote.prflx + r.remote.relay

  // 1. Nothing at all came from them. That is not a NAT problem: the other browser is not
  //    gathering addresses (WebRTC blocked/disabled), or their signaling dropped.
  if (remoteTotal === 0) {
    return {
      code: 'no-remote-candidates',
      message: 'No network info received from them. Ask them to reload the page.',
      hint:
        'No ICE candidate ever arrived from the other side. This is not NAT: their browser is not ' +
        'producing candidates (WebRTC disabled or restricted by a setting/extension/VPN), or their ' +
        'signaling connection dropped.',
    }
  }

  // 2. We got no relay address although we need/expect one.
  if (r.relayOnly && r.local.relay === 0) {
    return {
      code: 'relay-unreachable',
      message: 'Relay-only mode is on, but the relay server could not be reached.',
      hint:
        'iceTransportPolicy is "relay" but no relay candidate was gathered. TURN is unreachable from ' +
        'this network (port blocked) or the credentials were rejected (check TURN_SECRET matches coturn).',
    }
  }
  if (r.turnConfigured && r.local.relay === 0) {
    const first = r.serverErrors[0]
    return {
      code: 'turn-failed',
      message: 'A relay server is configured but this network could not use it.',
      hint:
        'TURN_URLS is set but no relay candidate was gathered. Usual causes: TURN_SECRET differs from ' +
        "coturn's static-auth-secret (401), coturn's ports are blocked or its external-ip is wrong, or " +
        'this network blocks UDP to it (add a ?transport=tcp URL).' +
        (first ? ` First error: ${first.code} ${first.text} (${first.url}).` : ''),
    }
  }

  // 3. No relay was ever available, and the direct path failed.
  if (!r.turnConfigured) {
    if (r.stunConfigured && r.local.srflx === 0) {
      return {
        code: 'stun-blocked',
        message: 'Your network blocks the connection setup (UDP), and the server has no relay.',
        hint:
          'No server-reflexive candidate was gathered: UDP to the STUN server is blocked here, so we ' +
          'cannot even learn our public address. Only a TURN server (ideally reachable over TCP/443) fixes this.',
      }
    }
    return {
      code: 'needs-relay',
      message: "Direct connection failed and the server has no relay (TURN). Typical of mobile/carrier networks.",
      hint:
        'Both sides produced candidates, none of the direct pairs worked, and no TURN server is configured. ' +
        'This is what symmetric or carrier-grade NAT looks like. Configure TURN_URLS/TURN_SECRET.',
    }
  }

  // 4. A relay exists and we have a relay candidate, and it still failed.
  return {
    code: 'relay-failed',
    message: 'Could not connect, even through the relay.',
    hint:
      'We have a relay candidate but no pair succeeded. Check that the other side also reaches TURN ' +
      '(see their console), and that coturn allows relaying to their address (denied-peer-ip rules).',
  }
}
