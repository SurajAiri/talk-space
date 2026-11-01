export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * True when a database error is a unique-constraint violation (Postgres code 23505).
 * Drizzle wraps driver errors in a DrizzleQueryError and keeps the original in `cause`,
 * so the code has to be looked for down the chain, not only on the error itself.
 */
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && typeof e === "object" && depth < 5; depth++) {
    if ((e as { code?: unknown }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
