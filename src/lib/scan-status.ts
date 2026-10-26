/**
 * What the dashboard may honestly say about its own data.
 *
 * Two questions, both of which the UI previously answered wrongly:
 *   - "How current is this?" — the footer showed render time, so a dashboard
 *     whose scan had failed for six weeks still read as generated "now".
 *   - "Which sites are no longer up?" — only a recorded live -> offline
 *     transition counts. A domain that never served is not a takedown.
 */

import type { DiscoveryRun, Dataset, DomainRecord } from './types';

/** The scan runs daily; this tolerates exactly one missed or late run. */
export const STALE_AFTER_DAYS = 2;

const DAY_MS = 86_400_000;

/**
 * Domains we recorded as live that are offline now, newest takedown first.
 * `takenDownAt` is stamped only on the live -> offline edge, so it is the
 * evidence that the site was once up.
 */
export function noLongerActive(domains: DomainRecord[]): DomainRecord[] {
  return domains
    .filter((d) => d.classification !== 'legitimate' && !d.isLive && d.takenDownAt)
    .sort((a, b) => (b.takenDownAt ?? '').localeCompare(a.takenDownAt ?? ''));
}

export interface ScanFreshness {
  lastScanAt: string | null;
  ageDays: number | null;
  isStale: boolean;
  /** Why the data cannot be treated as current, or null when it can. */
  reason: 'fixture' | 'no_runs' | 'stale' | null;
}

export function scanFreshness(
  runs: DiscoveryRun[],
  source: Dataset['source'],
  now: Date = new Date()
): ScanFreshness {
  const lastScanAt =
    runs
      .filter((r) => r.status === 'done' && r.finishedAt)
      .map((r) => r.finishedAt as string)
      .sort()
      .at(-1) ?? null;

  if (!lastScanAt) return { lastScanAt: null, ageDays: null, isStale: true, reason: 'no_runs' };

  const ageMs = now.getTime() - new Date(lastScanAt).getTime();
  const ageDays = Math.max(0, Math.floor(ageMs / DAY_MS));

  // The fixture is a frozen file bundled with the build: never current.
  if (source === 'fixture') return { lastScanAt, ageDays, isStale: true, reason: 'fixture' };

  const isStale = ageMs > STALE_AFTER_DAYS * DAY_MS;
  return { lastScanAt, ageDays, isStale, reason: isStale ? 'stale' : null };
}
