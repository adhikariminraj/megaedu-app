/**
 * Runs `fn` over `items`, at most `limit` in flight at once, preserving
 * input order in the returned results. Used wherever a route needs to
 * apply many independent, per-item database transactions in one
 * request (e.g. bulk Homework Completion save) without either (a)
 * firing them all at once — which can exceed SQLite's single-writer
 * lock queue depth within Prisma's interactive-transaction timeout, see
 * the empirical benchmark below — or (b) collapsing them into one
 * all-or-nothing transaction, which would break per-item independence.
 *
 * Deliberately generic and tiny — no external queue library, no retry
 * logic, no backoff. Each item's own promise is caught individually via
 * Promise.allSettled per chunk, so one item's rejection never stops the
 * remaining items in its chunk (or later chunks) from running.
 */
export async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: "fulfilled", value: await fn(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
