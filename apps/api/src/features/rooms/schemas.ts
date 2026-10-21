import { z } from "zod";
import {
  JOIN_CODE_REGEX,
  LANGUAGE_VALUES,
  MAP_VALUES,
  PURPOSE_VALUES,
  ROOM_CONFIG,
} from "../../config/rooms.config.js";

const roomId = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[A-Z]{${ROOM_CONFIG.idLength}}$`), "Invalid room id");

const joinCode = z.string().trim().regex(JOIN_CODE_REGEX, "Invalid join code");

const language = z.string().refine((v) => LANGUAGE_VALUES.has(v), "Unsupported language");

const tag = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    new RegExp(`^[a-z0-9+#.-]{${ROOM_CONFIG.tags.minLength},${ROOM_CONFIG.tags.maxLength}}$`),
    `Tags are ${ROOM_CONFIG.tags.minLength}-${ROOM_CONFIG.tags.maxLength} characters: letters, numbers, + # . -`,
  );

export const createRoomSchema = z.object({
  title: z
    .string()
    .trim()
    .min(ROOM_CONFIG.title.min, `Title must be at least ${ROOM_CONFIG.title.min} characters`)
    .max(ROOM_CONFIG.title.max),
  shortDescription: z.string().trim().max(ROOM_CONFIG.shortDescriptionMax).default(""),
  language,
  purpose: z.enum(PURPOSE_VALUES),
  tags: z
    .array(tag)
    .max(ROOM_CONFIG.tags.max, `At most ${ROOM_CONFIG.tags.max} tags`)
    .default([])
    .transform((t) => [...new Set(t)]),
  map: z.enum(MAP_VALUES),
  visibility: z.enum(["public", "private"]),
});

export const listRoomsSchema = z.object({
  language: language.optional(),
  purpose: z.enum(PURPOSE_VALUES).optional(),
  // comma separated: ?tags=react,rust
  tags: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 10)
        : [],
    ),
  q: z.string().trim().max(60).optional(),
  hasSpace: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const roomIdParamSchema = z.object({ roomId });

export const joinPayloadSchema = z.object({
  roomId,
  joinCode: joinCode.optional(),
});

export const signalPayloadSchema = z.object({
  to: z.uuid(),
  data: z
    .object({
      description: z.object({ type: z.enum(["offer", "answer"]), sdp: z.string().max(20_000) }).optional(),
      candidate: z
        .object({
          candidate: z.string().max(2_000),
          sdpMid: z.string().nullable().optional(),
          sdpMLineIndex: z.number().int().nullable().optional(),
          usernameFragment: z.string().nullable().optional(),
        })
        .optional(),
    })
    .refine((d) => d.description || d.candidate, "Empty signal"),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type ListRoomsInput = z.infer<typeof listRoomsSchema>;
