import type { Purpose, RoomMap, Visibility } from "../../config/rooms.config.js";

/** Stored in Redis at room:{id} (JSON). Immutable after creation. */
export interface RoomMeta {
  id: string;
  title: string;
  shortDescription: string;
  language: string;
  purpose: Purpose;
  tags: string[];
  /** Absent on rooms stored before maps existed; read it through `toView` (defaults to "none"). */
  map?: RoomMap;
  visibility: Visibility;
  maxMembers: number;
  createdAt: number;
  createdBy: string;
  /** private rooms only */
  joinCode?: string;
}

/** Stored per participant in the room:{id}:members hash. */
export interface Member {
  id: string;
  name: string;
  username: string;
  socketId: string;
  joinedAt: number;
}

export type PeerProfile = Pick<Member, "id" | "name" | "username">;

/** What clients see. joinCode only goes to people already inside / the creator. */
export interface RoomView {
  id: string;
  title: string;
  shortDescription: string;
  language: string;
  purpose: Purpose;
  tags: string[];
  map: RoomMap;
  visibility: Visibility;
  maxMembers: number;
  createdAt: number;
  createdBy: string;
  participantCount: number;
  joinCode?: string;
}

export type JoinErrorCode =
  | "INVALID_REQUEST"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "JOIN_CODE_REQUIRED"
  | "INVALID_JOIN_CODE"
  | "TOO_MANY_ATTEMPTS"
  | "ALREADY_IN_ROOM"
  | "INTERNAL";
