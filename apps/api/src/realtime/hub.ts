import type { Server } from "socket.io";

/**
 * Lets HTTP handlers (e.g. an admin banning someone) reach the socket server
 * without importing it, which would be a circular dependency.
 */
let io: Server<any, any, any, any> | null = null;

export const setIo = (server: Server<any, any, any, any>) => {
  io = server;
};

export const userChannel = (userId: string) => `user:${userId}`;

/** Drops every live connection of this user (all tabs, all server instances). */
export function disconnectUser(userId: string) {
  io?.in(userChannel(userId)).disconnectSockets(true);
}
