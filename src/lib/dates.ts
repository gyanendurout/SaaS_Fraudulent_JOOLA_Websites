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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The month range a set of dates covers, e.g. `Jul–Sep 2026`. Read straight
 * from the ISO strings, so it cannot shift across a timezone boundary.
 */
export function monthSpan(dates: Array<string | null | undefined>): string | null {
  const days = dates.map((d) => isoDay(d, '')).filter(Boolean).sort();
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  if (!firstDay || !lastDay) return null;
  const [fy, fm] = firstDay.split('-');
  const [ly, lm] = lastDay.split('-');
  const first = MONTHS[Number(fm) - 1];
  const last = MONTHS[Number(lm) - 1];
  if (fy !== ly) return `${first} ${fy}–${last} ${ly}`;
  return fm === lm ? `${first} ${fy}` : `${first}–${last} ${fy}`;
}
