import { ROOM_CONFIG } from "../../config/rooms.config.js";
import { AppError } from "../../utils/errors.js";
import type { CreateRoomInput, ListRoomsInput } from "./schemas.js";
import { generateJoinCode } from "./ids.js";
import * as store from "./store.js";
import type { JoinErrorCode, Member, PeerProfile, RoomMeta, RoomView } from "./types.js";

export function toView(
  meta: RoomMeta,
  participantCount: number,
  opts: { includeJoinCode: boolean },
): RoomView {
  const { joinCode, ...rest } = meta;
  return {
    ...rest,
    participantCount,
    ...(opts.includeJoinCode && joinCode ? { joinCode } : {}),
  };
}

export async function createRoom(userId: string, input: CreateRoomInput) {
  const created = await store.bump(`create:${userId}`, ROOM_CONFIG.createWindowSeconds);
  if (created > ROOM_CONFIG.createsPerWindow) {
    throw new AppError(429, "You're creating rooms too quickly. Try again in a few minutes.");
  }

  const meta = await store.createRoom({
    ...input,
    createdBy: userId,
    ...(input.visibility === "private" ? { joinCode: generateJoinCode() } : {}),
  });
  return toView(meta, 0, { includeJoinCode: true });
}

export async function listPublicRooms(filter: ListRoomsInput) {
  const rooms = await store.listPublic(filter);
  // never leak a joinCode into the listing (public rooms have none, but be explicit)
  return rooms.map((r) => toView(r, r.participantCount, { includeJoinCode: false }));
}

/** Minimal, safe-to-show info used by the pre-join screen. */
export async function previewRoom(roomId: string) {
  const meta = await store.getMeta(roomId);
  if (!meta) throw new AppError(404, "Room not found. It may have ended.");
  const count = await store.participantCount(roomId);

  if (meta.visibility === "private") {
    return {
      id: meta.id,
      visibility: "private" as const,
      requiresJoinCode: true,
      participantCount: count,
      maxMembers: meta.maxMembers,
    };
  }
  return {
    ...toView(meta, count, { includeJoinCode: false }),
    requiresJoinCode: false,
  };
}

export type JoinOutcome =
  | { ok: true; room: RoomView; peers: PeerProfile[]; replaced: Member | null }
  | { ok: false; code: JoinErrorCode; message: string };

const fail = (code: JoinErrorCode, message: string): JoinOutcome => ({ ok: false, code, message });

export async function joinRoom(args: {
  roomId: string;
  joinCode?: string;
  user: { id: string; name: string; username: string };
  socketId: string;
}): Promise<JoinOutcome> {
  const { roomId, joinCode, user, socketId } = args;

  const meta = await store.getMeta(roomId);
  if (!meta) return fail("ROOM_NOT_FOUND", "Room not found. It may have ended.");

  // Private rooms: the creator walks in; everyone else needs the code.
  if (meta.visibility === "private" && meta.createdBy !== user.id) {
    if (!joinCode) return fail("JOIN_CODE_REQUIRED", "This room is private. Enter its join code.");

    const userKey = `join:${roomId}:${user.id}`;
    const roomKey = `join:${roomId}`;
    const [byUser, byRoom] = await Promise.all([store.peek(userKey), store.peek(roomKey)]);
    if (
      byUser >= ROOM_CONFIG.joinAttemptsPerUser ||
      byRoom >= ROOM_CONFIG.joinAttemptsPerRoom
    ) {
      return fail("TOO_MANY_ATTEMPTS", "Too many wrong codes. Try again in a few minutes.");
    }
    if (!meta.joinCode || !store.codesMatch(meta.joinCode, joinCode)) {
      await Promise.all([
        store.bump(userKey, ROOM_CONFIG.joinAttemptWindowSeconds),
        store.bump(roomKey, ROOM_CONFIG.joinAttemptWindowSeconds),
      ]);
      return fail("INVALID_JOIN_CODE", "That join code is wrong.");
    }
  }

  const member: Member = {
    id: user.id,
    name: user.name,
    username: user.username,
    socketId,
    joinedAt: Date.now(),
  };
  const result = await store.addMember(meta, member);
  if (result.status !== "joined") {
    return result.status === "full"
      ? fail("ROOM_FULL", `This room is full (${meta.maxMembers} people).`)
      : fail("ROOM_NOT_FOUND", "Room not found. It may have ended.");
  }

  const members = await store.listMembers(roomId);
  return {
    ok: true,
    room: toView(meta, members.length, { includeJoinCode: true }),
    peers: members.filter((m) => m.id !== user.id).map(store.toPeer),
    replaced: result.previous,
  };
}

/** `graceful` = the user pressed Leave (delete an empty room right away). */
export function leaveRoom(roomId: string, userId: string, socketId: string, graceful: boolean) {
  return store.removeMember(
    roomId,
    userId,
    socketId,
    graceful ? 0 : ROOM_CONFIG.emptyGraceSeconds,
  );
}
