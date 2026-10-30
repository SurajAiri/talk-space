import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { reports, users } from "../../db/schema/index.js";
import { ROOM_CONFIG } from "../../config/rooms.config.js";
import { bumpCounter } from "../../lib/rateLimit.js";
import { disconnectUser } from "../../realtime/hub.js";
import { AppError } from "../../utils/errors.js";
import { bothInRoom } from "../rooms/services.js";
import { revokeTokens } from "../user/services.js";
import type { CreateReportInput } from "./schemas.js";

/** Strikes at which an account is suspended automatically. */
export const STRIKE_LIMIT = 3;

export async function createReport(reporterId: string, input: CreateReportInput) {
  if (input.reportedId === reporterId) throw new AppError(400, "You can't report yourself.");

  const { count } = await bumpCounter(`report:${reporterId}`, 3600);
  if (count > ROOM_CONFIG.reportsPerHour) {
    throw new AppError(429, "You've sent a lot of reports. Please try again later.");
  }

  // Chat is peer-to-peer, so the server has no transcript. What it CAN check is
  // that both people were in that room together right now: this stops reports
  // against strangers the reporter never met.
  if (!(await bothInRoom(input.roomId, reporterId, input.reportedId))) {
    throw new AppError(409, "You can only report someone who is in your room right now.");
  }

  const [row] = await db
    .insert(reports)
    .values({
      reporterId,
      reportedId: input.reportedId,
      roomId: input.roomId,
      reason: input.reason,
      details: input.details || null,
      messageExcerpt: input.messageExcerpt || null,
    })
    .returning({ id: reports.id });
  return row!;
}

export async function listReports(status: "open" | "dismissed" | "actioned", limit: number) {
  return db
    .select({
      id: reports.id,
      roomId: reports.roomId,
      reason: reports.reason,
      details: reports.details,
      messageExcerpt: reports.messageExcerpt,
      status: reports.status,
      resolution: reports.resolution,
      createdAt: reports.createdAt,
      reporterId: reports.reporterId,
      reportedId: reports.reportedId,
      reportedUsername: users.username,
      reportedStrikes: users.strikes,
      reportedStatus: users.status,
      // how many separate people have complained about this account
      reportsAgainst: sql<number>`(select count(distinct reporter_id)::int from reports r2 where r2.reported_id = ${reports.reportedId})`,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reportedId))
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(limit);
}

export type ReportAction = "dismiss" | "strike" | "suspend" | "ban";

export async function resolveReport(reportId: string, adminId: string, action: ReportAction) {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!report) throw new AppError(404, "Report not found");
  if (report.status !== "open") throw new AppError(409, "This report was already handled");

  if (action !== "dismiss") {
    const patch =
      action === "ban"
        ? { status: "banned" as const, strikes: sql`${users.strikes} + 1` }
        : action === "suspend"
          ? { status: "suspended" as const, strikes: sql`${users.strikes} + 1` }
          : { strikes: sql`${users.strikes} + 1` };
    const [updated] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, report.reportedId))
      .returning({ id: users.id, strikes: users.strikes, status: users.status });

    if (updated) {
      // enough strikes: suspended without anyone having to remember
      if (updated.status === "active" && updated.strikes >= STRIKE_LIMIT) {
        await db.update(users).set({ status: "suspended" }).where(eq(users.id, updated.id));
        updated.status = "suspended";
      }
      if (updated.status !== "active") {
        // end their session now: old tokens stop working and live sockets close
        await revokeTokens(updated.id);
        disconnectUser(updated.id);
      }
    }
  }

  await db
    .update(reports)
    .set({
      status: action === "dismiss" ? "dismissed" : "actioned",
      resolution: action,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    })
    .where(and(eq(reports.id, reportId), eq(reports.status, "open")));
}
