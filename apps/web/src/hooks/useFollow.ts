import { useCallback, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { useRoomStore } from '../store/room.store'
import { NO_FOLLOW, type FollowSnapshot, type RequestResult } from '../world/follow'
import type { WorldSession } from '../world/WorldSession'

const noop = () => {}

/** Who follows whom right now (world/follow.ts). Re-renders only when that changes. */
export function useFollow(world: WorldSession | null): FollowSnapshot {
  const subscribe = useCallback((cb: () => void) => world?.follow.subscribe(cb) ?? noop, [world])
  return useSyncExternalStore(subscribe, () => world?.follow.snapshot ?? NO_FOLLOW)
}

const WHY: Record<Exclude<RequestResult, 'sent' | 'already'>, (name: string) => string> = {
  blocked: (n) => `You blocked ${n}. Unblock them first.`,
  cooldown: (n) => `${n} said no a moment ago. Try again in a minute.`,
  'slow-down': () => 'Slow down a little, then try again.',
  unreachable: (n) => `Couldn't reach ${n}. Their connection may still be starting.`,
}

/** Everything the menu, the People list and the status chip need to know about ONE other person, and what they can do about it. */
export function usePeerFollow(peerId: string) {
  const world = useRoomStore((s) => s.world)
  const name = useRoomStore((s) => s.peers[peerId]?.name ?? 'Them')
  const blocked = useRoomStore((s) => Boolean(s.blocked[peerId]))
  const snap = useFollow(world)

  const iFollow = snap.following === peerId
  return {
    /** rooms without a map have no world, so nothing to follow in */
    available: world !== null,
    blocked,
    iFollow,
    paused: iFollow && snap.paused,
    pendingOut: snap.pending === peerId,
    theyAsked: snap.incoming.includes(peerId),
    theyFollow: snap.followers.includes(peerId),
    ask() {
      const r = world?.follow.request(peerId)
      if (r && r !== 'sent' && r !== 'already') toast.error(WHY[r](name))
    },
    cancel: () => world?.follow.cancelRequest(),
    accept() {
      if (!world?.follow.accept(peerId)) toast.error(`Couldn't accept: ${name} is no longer waiting.`)
    },
    decline: () => world?.follow.decline(peerId),
    stop: () => world?.follow.stopFollowing(),
    pause: () => world?.follow.pause(),
    resume: () => world?.follow.resume(),
    remove: () => world?.follow.removeFollower(peerId),
  }
}
