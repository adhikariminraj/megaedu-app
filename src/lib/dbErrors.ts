import { Prisma } from "@prisma/client";

/**
 * True when a transaction failed only because a simultaneous transaction
 * conflicted with it (finding F3): PostgreSQL aborted it as a deadlock
 * victim or as a serialization failure, and the whole transaction rolled
 * back. Retrying is safe, so callers answer 409 "please refresh and try
 * again" instead of a raw 500.
 *
 * Prisma 5.20 reports these two cases differently: a serialization failure
 * (SQLSTATE 40001) arrives as P2034, but a deadlock (SQLSTATE 40P01) is not
 * mapped at all — it arrives as a PrismaClientUnknownRequestError whose
 * message carries the SQLSTATE. That five-character code is PostgreSQL's
 * fixed identifier for a deadlock, so matching it is narrow and stable.
 */
export function isTransactionConflict(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code === "P2034";
  if (err instanceof Prisma.PrismaClientUnknownRequestError) return /\b40P01\b/.test(err.message);
  return false;
}
