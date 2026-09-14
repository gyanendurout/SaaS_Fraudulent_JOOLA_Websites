/**
 * Date rendering for evidence.
 *
 * These dates are quoted in registrar abuse complaints, so a one-day error is a
 * factual error in a legal document, not a cosmetic bug. This project has
 * already been bitten once: node-postgres parsed the DATE `2026-07-20` into
 * local midnight, which renders as 2026-07-19 in IST.
 *
 * The rule: never round-trip an evidence date through `Date`. Timestamps arrive
 * from Postgres as ISO-8601 strings that already begin `YYYY-MM-DD`; take those
 * characters and stop.
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/**
 * The calendar day of an ISO-8601 timestamp, exactly as stored.
 *
 * @param ts  ISO-8601 timestamp or date, e.g. `2026-07-20T00:00:00Z`.
 * @param fallback  Rendered when there is no usable date.
 */
export function isoDay(ts: string | null | undefined, fallback = '—'): string {
  if (!ts) return fallback;
  const match = ISO_DAY.exec(ts.trim());
  return match ? match[0] : fallback;
}
