import { randomInt } from "node:crypto";
import { ROOM_CONFIG } from "../../config/rooms.config.js";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateRoomId(): string {
  let id = "";
  for (let i = 0; i < ROOM_CONFIG.idLength; i++) id += LETTERS[randomInt(LETTERS.length)];
  return id;
}

export function generateJoinCode(): string {
  return String(randomInt(10 ** ROOM_CONFIG.joinCodeLength)).padStart(
    ROOM_CONFIG.joinCodeLength,
    "0",
  );
}
