import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const reportReasonEnum = pgEnum("report_reason", [
  "harassment",
  "hate",
  "sexual_content",
  "spam",
  "threats",
  "other",
]);
export const reportStatusEnum = pgEnum("report_status", ["open", "dismissed", "actioned"]);

/**
 * Chat and voice never touch the server, so a report is the only evidence the
 * platform ever sees. The excerpt is what the *reporter's* client claims it
 * received: treat it as a claim, not proof. The server does verify that both
 * people were in the named room at the same time.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedId: uuid("reported_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details"), // <= 500 chars
    messageExcerpt: text("message_excerpt"), // <= 500 chars, reporter-supplied
    status: reportStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"), // dismiss | strike | suspend | ban
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt), index("reports_reported_idx").on(t.reportedId)],
);

export type Report = typeof reports.$inferSelect;
