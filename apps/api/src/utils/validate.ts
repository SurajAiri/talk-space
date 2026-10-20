import type { ZodType } from "zod";
import { AppError } from "./errors.js";

/** Validates `data` against a zod schema; throws a 400 AppError on failure. */
export function parseInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? "Invalid input");
  }
  return result.data;
}
