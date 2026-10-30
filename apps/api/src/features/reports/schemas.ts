import { z } from "zod";
import { ROOM_ID_REGEX } from "../../config/rooms.config.js";

export const REPORT_REASONS = ["harassment", "hate", "sexual_content", "spam", "threats", "other"] as const;

export const createReportSchema = z.object({
  reportedId: z.uuid(),
  roomId: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => ROOM_ID_REGEX.test(v), "Invalid room id"),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
  messageExcerpt: z.string().trim().max(500).optional(),
});

export const resolveReportSchema = z.object({
  action: z.enum(["dismiss", "strike", "suspend", "ban"]),
});

export const listReportsSchema = z.object({
  status: z.enum(["open", "dismissed", "actioned"]).default("open"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
