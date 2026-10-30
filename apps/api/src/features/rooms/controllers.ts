import type { Request, Response } from "express";
import { publicRoomConfig } from "../../config/rooms.config.js";
import { AppError } from "../../utils/errors.js";
import {
  createRoomSchema,
  listRoomsSchema,
  roomIdParamSchema,
} from "./schemas.js";
import * as roomService from "./services.js";

function parse<S extends { safeParse: (d: unknown) => any }>(
  schema: S,
  data: unknown,
): ReturnType<S["safeParse"]> extends { data?: infer D } ? NonNullable<D> : never {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? "Invalid input");
  }
  return result.data;
}

export function getConfig(_req: Request, res: Response) {
  res.sendResponse(200, publicRoomConfig());
}

export async function create(req: Request, res: Response) {
  const input = parse(createRoomSchema, req.body);
  const room = await roomService.createRoom(req.auth!.id, input);
  res.sendResponse(201, room, "Room created");
}

export async function list(req: Request, res: Response) {
  const filter = parse(listRoomsSchema, req.query);
  res.sendResponse(200, await roomService.listPublicRooms(filter));
}

export async function preview(req: Request, res: Response) {
  const { roomId } = parse(roomIdParamSchema, req.params);
  res.sendResponse(200, await roomService.previewRoom(req.auth!.id, roomId));
}
