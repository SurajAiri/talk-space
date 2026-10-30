import type { Server as HttpServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env.js";
import { ROOM_CONFIG } from "../config/rooms.config.js";
import {
  joinPayloadSchema,
  kickPayloadSchema,
  signalPayloadSchema,
} from "../features/rooms/schemas.js";
import * as roomService from "../features/rooms/services.js";
import * as roomStore from "../features/rooms/store.js";
import type { JoinErrorCode, PeerProfile, RoomView } from "../features/rooms/types.js";
import { findAuthState, findUserById } from "../features/user/services.js";
import { redis } from "../lib/redis.js";
import { buildIceServers, type IceServer } from "../services/ice.service.js";
import { verifyJWT } from "../services/jwt.service.js";
import { setIo, userChannel } from "./hub.js";

/**
 * Signaling only. The server authenticates sockets, tracks who is in which
 * room (Redis) and relays the WebRTC handshake (offers/answers/ICE candidates)
 * between peers. Audio, chat and positions never touch this server: they flow
 * peer-to-peer over the connections this handshake sets up.
 *
 * Besides the handshake, the server only does connection bookkeeping: who joined,
 * who left, and (for the room's host) who was removed.
 */

export type SignalData = {
  description?: { type: "offer" | "answer"; sdp: string };
  candidate?: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
  reset?: true;
};

export type JoinAck =
  | {
      ok: true;
      room: RoomView;
      self: PeerProfile;
      peers: PeerProfile[];
      iceServers: IceServer[];
      /** "relay": every connection must go through TURN so peers never see each other's IP */
      iceTransportPolicy: "all" | "relay";
      /** a TURN server is configured, so a person may choose relay-only for themselves */
      relayAvailable: boolean;
      /** same tab, same seat: peer-to-peer links that are still alive may be kept */
      resumed: boolean;
    }
  | { ok: false; code: JoinErrorCode; message: string };

interface ClientToServerEvents {
  "room:join": (payload: unknown, ack: (res: JoinAck) => void) => void;
  "room:leave": (ack?: () => void) => void;
  "room:kick": (payload: unknown, ack?: (res: { ok: boolean; message?: string }) => void) => void;
  signal: (payload: unknown) => void;
}

interface ServerToClientEvents {
  "peer:joined": (peer: PeerProfile) => void;
  "peer:left": (payload: { userId: string }) => void;
  "room:replaced": () => void;
  "room:kicked": () => void;
  signal: (payload: { from: string; data: SignalData }) => void;
}

interface SocketData {
  user: PeerProfile;
  roomId?: string;
  joining?: boolean;
  signalWindowStart: number;
  signalCount: number;
  joinWindowStart: number;
  joinCount: number;
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export const SOCKET_PATH = "/api/v1/realtime";

const roomChannel = (roomId: string) => `room:${roomId}`;
const seatChannel = (roomId: string, userId: string) => `room:${roomId}:user:${userId}`;

// Signaling bursts (ICE candidates for up to ~7 peers) are fine; floods are not.
const SIGNAL_LIMIT = 600;
const SIGNAL_WINDOW_MS = 10_000;
// A tab has no reason to try joining rooms more than this often.
const JOIN_LIMIT = 10;
const JOIN_WINDOW_MS = 30_000;

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

  // Rooms, seats and "who is in this channel" are shared through Redis, so any
  // number of API instances can run side by side behind a load balancer.
  const pub = redis.duplicate();
  const sub = redis.duplicate();
  pub.on("error", (err) => console.error("Redis (socket pub) error:", err.message));
  sub.on("error", (err) => console.error("Redis (socket sub) error:", err.message));
  io.adapter(createAdapter(pub, sub));
  setIo(io);

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: unknown }).token;
      if (typeof token !== "string") return next(new Error("UNAUTHORIZED"));
      const { id, tv } = verifyJWT(token);
      const state = await findAuthState(id);
      if (!state || state.tokenVersion !== tv) return next(new Error("UNAUTHORIZED"));
      if (state.status !== "active") return next(new Error("ACCOUNT_" + state.status.toUpperCase()));
      const user = await findUserById(id);
      if (!user) return next(new Error("UNAUTHORIZED"));
      socket.data.user = { id: user.id, name: user.name, username: user.username };
      const now = Date.now();
      socket.data.signalWindowStart = now;
      socket.data.signalCount = 0;
      socket.data.joinWindowStart = now;
      socket.data.joinCount = 0;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  /** Seats that dropped without saying goodbye, waiting out the grace period (timer -> release now). */
  const graceTimers = new Map<ReturnType<typeof setTimeout>, () => Promise<void>>();
  /** Seat releases in flight; shutdown waits for them so none is lost. */
  const pending = new Set<Promise<unknown>>();
  let closing = false;
  const track = (p: Promise<unknown>) => {
    pending.add(p);
    void p.finally(() => pending.delete(p));
  };

  async function removeSeat(roomId: string, userId: string, socketId: string, graceful: boolean) {
    const removed = await roomService.leaveRoom(roomId, userId, socketId, graceful);
    if (removed) io.to(roomChannel(roomId)).emit("peer:left", { userId });
  }

  async function leave(socket: AppSocket) {
    const { roomId, user } = socket.data;
    if (!roomId) return;
    socket.data.roomId = undefined;
    void socket.leave(roomChannel(roomId));
    void socket.leave(seatChannel(roomId, user.id));
    await removeSeat(roomId, user.id, socket.id, true);
  }

  io.on("connection", (socket) => {
    void socket.join(userChannel(socket.data.user.id));

    socket.on("room:join", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const reply = (code: JoinErrorCode, message: string) => ack({ ok: false, code, message });

      const now = Date.now();
      if (now - socket.data.joinWindowStart > JOIN_WINDOW_MS) {
        socket.data.joinWindowStart = now;
        socket.data.joinCount = 0;
      }
      if (++socket.data.joinCount > JOIN_LIMIT) {
        return reply("TOO_MANY_ATTEMPTS", "Too many attempts. Wait a moment.");
      }

      if (socket.data.roomId || socket.data.joining) {
        return reply("ALREADY_IN_ROOM", "Leave your current room first.");
      }
      const parsed = joinPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        return reply("INVALID_REQUEST", parsed.error.issues[0]?.message ?? "Invalid request");
      }

      socket.data.joining = true;
      try {
        const { roomId, joinCode, sessionId } = parsed.data;
        const user = socket.data.user;
        const outcome = await roomService.joinRoom({ roomId, joinCode, user, socketId: socket.id, sessionId });
        if (!outcome.ok) return ack(outcome);

        socket.data.roomId = roomId;
        await socket.join([roomChannel(roomId), seatChannel(roomId, user.id)]);

        const old = outcome.replaced;
        // Same tab coming back after a dropped connection: its peer-to-peer links
        // never broke, and nobody was told it left, so nobody needs to hear it joined.
        const resumed = Boolean(old && sessionId && old.sessionId === sessionId);

        if (old && old.socketId !== socket.id) {
          io.in(old.socketId).socketsLeave([roomChannel(roomId), seatChannel(roomId, user.id)]);
          if (!resumed) io.to(old.socketId).emit("room:replaced");
          io.in(old.socketId).disconnectSockets(true);
        }

        // Tell existing members BEFORE acking, so their link to the newcomer
        // exists by the time the newcomer's first offer arrives.
        if (!resumed) socket.to(roomChannel(roomId)).emit("peer:joined", user);

        ack({
          ok: true,
          room: outcome.room,
          self: user,
          peers: outcome.peers,
          iceServers: buildIceServers(user.id),
          iceTransportPolicy: env.FORCE_RELAY ? "relay" : "all",
          relayAvailable: env.TURN_URLS.length > 0,
          resumed,
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
        await leave(socket);
      } catch (err) {
        console.error("room:leave failed", err);
      }
      if (typeof ack === "function") ack();
    });

    // The host removes someone. Nothing about messages: only who is seated.
    socket.on("room:kick", async (payload, ack) => {
      const done = (res: { ok: boolean; message?: string }) => typeof ack === "function" && ack(res);
      const { roomId, user } = socket.data;
      if (!roomId) return done({ ok: false, message: "You are not in a room." });
      const parsed = kickPayloadSchema.safeParse(payload);
      if (!parsed.success) return done({ ok: false, message: "Invalid request" });

      try {
        const outcome = await roomService.kickFromRoom({
          roomId,
          hostId: user.id,
          targetId: parsed.data.userId,
        });
        if (!outcome.ok) return done({ ok: false, message: outcome.message });

        const seat = seatChannel(roomId, parsed.data.userId);
        io.to(seat).emit("room:kicked");
        io.in(seat).socketsLeave([roomChannel(roomId), seat]);
        if (outcome.socketId) io.to(roomChannel(roomId)).emit("peer:left", { userId: parsed.data.userId });
        done({ ok: true });
      } catch (err) {
        console.error("room:kick failed", err);
        done({ ok: false, message: "Something went wrong." });
      }
    });

    socket.on("signal", (payload) => {
      const { roomId, user } = socket.data;
      // only people who currently hold a seat may signal (a kicked socket has left the channel)
      if (!roomId || !socket.rooms.has(roomChannel(roomId))) return;

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

    socket.on("disconnect", (reason) => {
      const { roomId, user } = socket.data;
      if (!roomId) return;
      const fail = (err: unknown) => console.error("leave on disconnect failed", err);
      const release = () => removeSeat(roomId, user.id, socket.id, false).catch(fail);

      // Closed on purpose (the client left, we removed the session, or this server is
      // shutting down and nobody would be left to run the grace timer): free the seat now.
      if (closing || reason === "client namespace disconnect" || reason === "server namespace disconnect") {
        track(release());
        return;
      }
      // Network blip, laptop lid, tunnel: keep the seat briefly. If the same person
      // comes back with a new socket the seat is theirs again and nobody noticed.
      // If not, the seat is released (only if THIS socket still holds it).
      const timer = setTimeout(() => {
        graceTimers.delete(timer);
        track(release());
      }, ROOM_CONFIG.seatGraceSeconds * 1000);
      timer.unref?.();
      graceTimers.set(timer, release);
    });
  });

  /**
   * Safety net for seats whose owner vanished without any server noticing (a crash,
   * a kill -9, a lost Redis message): a seat whose socket exists nowhere in the cluster
   * on two sweeps in a row is released. Without this such a "ghost" would hold a place
   * in the room, and keep the room alive, forever.
   */
  async function sweepGhostSeats() {
    for await (const roomId of roomStore.scanRoomIds()) {
      const live = new Set((await io.in(roomChannel(roomId)).fetchSockets()).map((s) => s.id));
      for (const m of await roomStore.listMembers(roomId)) {
        const ghostKey = `ghost:${roomId}:${m.id}`;
        if (live.has(m.socketId)) {
          await redis.del(ghostKey);
          continue;
        }
        const firstSighting = await redis.set(ghostKey, m.socketId, "EX", 180, "NX");
        if (firstSighting === "OK") continue;
        if ((await redis.get(ghostKey)) === m.socketId) {
          await redis.del(ghostKey);
          await removeSeat(roomId, m.id, m.socketId, false);
        }
      }
    }
  }
  const sweeper = setInterval(() => {
    sweepGhostSeats().catch((err) => console.error("ghost seat sweep failed", err));
  }, 30_000);
  sweeper.unref();

  return Object.assign(io, {
    /** Runs one ghost-seat sweep now (the interval also does this every 30 s). */
    sweepGhostSeats,
    /** For shutdown: stop waiting for grace periods and release those seats right away. */
    async closeAll() {
      closing = true;
      clearInterval(sweeper);
      for (const [timer, release] of graceTimers) {
        clearTimeout(timer);
        track(release());
      }
      graceTimers.clear();
      await new Promise<void>((resolve) => void io.close(() => resolve()));
      await Promise.allSettled([...pending]);
      pub.disconnect();
      sub.disconnect();
    },
  });
}
