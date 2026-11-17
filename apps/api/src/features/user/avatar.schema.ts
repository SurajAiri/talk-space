import { z } from "zod";
import { AVATAR_CONFIG } from "../../config/avatar.config.js";

/** A designed character. Every field is checked against the lists in config/avatar.config.ts; nothing else is accepted. */
export const avatarSchema = z
  .object({
    skin: z.number().int().min(0).max(AVATAR_CONFIG.skin - 1),
    hairStyle: z.enum(AVATAR_CONFIG.hairStyles),
    hairColor: z.number().int().min(0).max(AVATAR_CONFIG.hairColor - 1),
    shirtStyle: z.enum(AVATAR_CONFIG.shirtStyles),
    shirt: z.number().int().min(0).max(AVATAR_CONFIG.shirt - 1),
    pants: z.number().int().min(0).max(AVATAR_CONFIG.pants - 1),
    accessory: z.enum(AVATAR_CONFIG.accessories),
  })
  .strict();
