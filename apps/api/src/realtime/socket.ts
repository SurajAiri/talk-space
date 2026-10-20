import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env.js";
import { joinPayloadSchema, signalPayloadSchema } from "../features/rooms/schemas.js";
import * as roomService from "../features/rooms/services.js";
import type { JoinErrorCode, PeerProfile, RoomView } from "../features/rooms/types.js";
import { findUserById } from "../features/user/services.js";
import { buildIceServers, type IceServer } from "../services/ice.service.js";
import { verifyJWT } from "../services/jwt.service.js";

/**
 * Signaling only. The server authenticates sockets, tracks who is in which
 * room (Redis) and relays WebRTC offers/answers/ICE candidates between peers.
 * Audio and chat never touch this server: they flow peer-to-peer.
 */

export type SignalData = {
  description?: { type: "offer" | "answer"; sdp: string };
  candidate?: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
};

export type JoinAck =
  | { ok: true; room: RoomView; self: PeerProfile; peers: PeerProfile[]; iceServers: IceServer[] }
  | { ok: false; code: JoinErrorCode; message: string };

interface ClientToServerEvents {
  "room:join": (payload: unknown, ack: (res: JoinAck) => void) => void;
  "room:leave": (ack?: () => void) => void;
  signal: (payload: unknown) => void;
}

interface ServerToClientEvents {
  "peer:joined": (peer: PeerProfile) => void;
  "peer:left": (payload: { userId: string }) => void;
  "room:replaced": () => void;
  signal: (payload: { from: string; data: SignalData }) => void;
}

interface SocketData {
  user: PeerProfile;
  roomId?: string;
  joining?: boolean;
  signalWindowStart: number;
  signalCount: number;
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export const SOCKET_PATH = "/api/v1/realtime";

const roomChannel = (roomId: string) => `room:${roomId}`;
const seatChannel = (roomId: string, userId: string) => `room:${roomId}:user:${userId}`;

// Signaling bursts (ICE candidates for up to ~7 peers) are fine; floods are not.
const SIGNAL_LIMIT = 600;
const SIGNAL_WINDOW_MS = 10_000;

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    {
      path: SOCKET_PATH,
      cors: { origin: env.WEB_URL },
      maxHttpBufferSize: 64 * 1024,
      transports: ["websocket"],
    },
  );

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: unknown }).token;
      if (typeof token !== "string") return next(new Error("UNAUTHORIZED"));
      const { id } = verifyJWT(token);
      const user = await findUserById(id);
      if (!user) return next(new Error("UNAUTHORIZED"));
      if (user.status !== "active") return next(new Error("ACCOUNT_" + user.status.toUpperCase()));
      socket.data.user = { id: user.id, name: user.name, username: user.username };
      socket.data.signalWindowStart = Date.now();
      socket.data.signalCount = 0;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  async function leave(socket: AppSocket, graceful: boolean) {
    const { roomId, user } = socket.data;
    if (!roomId) return;
    socket.data.roomId = undefined;
    void socket.leave(roomChannel(roomId));
    void socket.leave(seatChannel(roomId, user.id));

    const removed = await roomService.leaveRoom(roomId, user.id, socket.id, graceful);
    if (removed) io.to(roomChannel(roomId)).emit("peer:left", { userId: user.id });
  }

  io.on("connection", (socket) => {
    socket.on("room:join", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const reply = (code: JoinErrorCode, message: string) => ack({ ok: false, code, message });

      if (socket.data.roomId || socket.data.joining) {
        return reply("ALREADY_IN_ROOM", "Leave your current room first.");
      }
      const parsed = joinPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        return reply("INVALID_REQUEST", parsed.error.issues[0]?.message ?? "Invalid request");
      }

      socket.data.joining = true;
      try {
        const { roomId, joinCode } = parsed.data;
        const user = socket.data.user;
        const outcome = await roomService.joinRoom({ roomId, joinCode, user, socketId: socket.id });
        if (!outcome.ok) return ack(outcome);

        socket.data.roomId = roomId;
        await socket.join([roomChannel(roomId), seatChannel(roomId, user.id)]);

        // Same user joined from another tab/device: that session loses its seat.
        const old = outcome.replaced;
        if (old && old.socketId !== socket.id) {
          io.in(old.socketId).socketsLeave([roomChannel(roomId), seatChannel(roomId, user.id)]);
          io.to(old.socketId).emit("room:replaced");
          io.in(old.socketId).disconnectSockets(true);
        }

        // Tell existing members BEFORE acking, so their link to the newcomer
        // exists by the time the newcomer's first offer arrives.
        socket.to(roomChannel(roomId)).emit("peer:joined", user);

        ack({
          ok: true,
          room: outcome.room,
          self: user,
          peers: outcome.peers,
          iceServers: buildIceServers(user.id),
        });
      } catch (err) {
        console.error("room:join failed", err);
        reply("INTERNAL", "Something went wrong joining the room.");
      } finally {
        socket.data.joining = false;
      }
    });

    socket.on("room:leave", async (ack) => {
      try {
        await leave(socket, true);
      } catch (err) {
        console.error("room:leave failed", err);
      }
      if (typeof ack === "function") ack();
    });

    socket.on("signal", (payload) => {
      const { roomId, user } = socket.data;
      if (!roomId) return;

      const now = Date.now();
      if (now - socket.data.signalWindowStart > SIGNAL_WINDOW_MS) {
        socket.data.signalWindowStart = now;
        socket.data.signalCount = 0;
      }
      if (++socket.data.signalCount > SIGNAL_LIMIT) return;

      const parsed = signalPayloadSchema.safeParse(payload);
      if (!parsed.success || parsed.data.to === user.id) return;

      // Only sockets seated in the same room are in this channel, so a peer
      // can never signal someone outside its room.
      socket
        .to(seatChannel(roomId, parsed.data.to))
        .emit("signal", { from: user.id, data: parsed.data.data as SignalData });
    });

    socket.on("disconnect", () => {
      leave(socket, false).catch((err) => console.error("leave on disconnect failed", err));
    });
  });

  return io;
}
