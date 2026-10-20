import type { Request, Response } from "express";
import { parseInput } from "../../utils/validate.js";
import { createRoomSchema, joinRoomSchema, roomIdSchema } from "./schemas.js";
import * as roomService from "./services.js";

const roomId = (req: Request) => parseInput(roomIdSchema, req.params.roomId);

export async function createRoom(req: Request, res: Response) {
  const input = parseInput(createRoomSchema, req.body);
  const room = await roomService.createRoom(req.user!.id, input);
  res.sendResponse(201, room, "Room created");
}

export async function listRooms(_req: Request, res: Response) {
  const rooms = await roomService.listPublicRooms();
  res.sendResponse(200, rooms, undefined, { count: rooms.length });
}

export async function getRoom(req: Request, res: Response) {
  res.sendResponse(200, await roomService.getRoom(roomId(req), req.user!.id));
}

export async function joinRoom(req: Request, res: Response) {
  const { code } = parseInput(joinRoomSchema, req.body ?? {});
  const room = await roomService.joinRoom(roomId(req), req.user!.id, code);
  res.sendResponse(200, room, "Joined room");
}

export async function leaveRoom(req: Request, res: Response) {
  res.sendResponse(200, await roomService.leaveRoom(roomId(req), req.user!.id), "Left room");
}

export async function heartbeat(req: Request, res: Response) {
  res.sendResponse(200, await roomService.heartbeat(roomId(req), req.user!.id));
}
