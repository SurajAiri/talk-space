import { z } from "zod";
import {
  DEFAULT_MAX_PARTICIPANTS,
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  ROOM_ID_LENGTH,
  ROOM_PURPOSES,
  ROOM_VISIBILITIES,
} from "./constants.js";

export const createRoomSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(60, "Title is too long (max 60)"),
  description: z.string().trim().max(200, "Description is too long (max 200)").default(""),
  language: z.string().trim().min(2, "Language is required").max(30),
  purpose: z.enum(ROOM_PURPOSES, "Invalid purpose"),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(20, "Tags can be 20 characters at most"))
    .max(5, "At most 5 tags")
    .default([])
    .transform((tags) => [...new Set(tags)]),
  visibility: z.enum(ROOM_VISIBILITIES, "Visibility must be public or private"),
  maxParticipants: z
    .number("maxParticipants must be a number")
    .int()
    .min(MIN_PARTICIPANTS, `A room must allow at least ${MIN_PARTICIPANTS} people`)
    .max(MAX_PARTICIPANTS, `A room can hold at most ${MAX_PARTICIPANTS} people`)
    .default(DEFAULT_MAX_PARTICIPANTS),
});

// Room IDs are case-insensitive: normalise to upper case.
export const roomIdSchema = z
  .string()
  .regex(new RegExp(`^[a-z0-9]{${ROOM_ID_LENGTH}}$`, "i"), "Invalid room ID")
  .transform((id) => id.toUpperCase());

export const joinRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Join code must be 6 digits")
    .optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
