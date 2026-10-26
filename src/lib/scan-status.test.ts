import { describe, test, expect } from 'vitest';
import { noLongerActive, scanFreshness, STALE_AFTER_DAYS } from './scan-status';
import type { DomainRecord, DiscoveryRun } from './types';

const domain = (over: Partial<DomainRecord>): DomainRecord =>
  ({
    domain: 'x.com',
    classification: 'suspect',
    isLive: false,
    takenDownAt: null,
    ...over,
  }) as DomainRecord;

const run = (finishedAt: string | null, status = 'done'): DiscoveryRun => ({
  runType: 'dns_permutation',
  status,
  candidatesTested: 1519,
  candidatesResolved: 45,
  startedAt: finishedAt ?? '2026-10-01T00:00:00Z',
  finishedAt,
});

describe('noLongerActive', () => {
  test('includes only domains recorded live before and offline now', () => {
    const rows = noLongerActive([
      domain({ domain: 'gone.com', takenDownAt: '2026-08-31T00:00:00Z' }),
      domain({ domain: 'never-served.com', takenDownAt: null }),
      domain({ domain: 'still-up.com', isLive: true, takenDownAt: null }),
    ]);
    expect(rows.map((d) => d.domain)).toEqual(['gone.com']);
  });

  test('never lists the verified JOOLA estate', () => {
    const rows = noLongerActive([
      domain({ domain: 'joola.com', classification: 'legitimate', takenDownAt: '2026-09-01T00:00:00Z' }),
    ]);
    expect(rows).toEqual([]);
  });

  test('excludes a domain that came back online even if a stamp lingers', () => {
    const rows = noLongerActive([domain({ isLive: true, takenDownAt: '2026-09-01T00:00:00Z' })]);
    expect(rows).toEqual([]);
  });

  test('orders the most recent takedown first', () => {
    const rows = noLongerActive([
      domain({ domain: 'older.com', takenDownAt: '2026-08-31T00:00:00Z' }),
      domain({ domain: 'newer.com', takenDownAt: '2026-10-20T00:00:00Z' }),
    ]);
    expect(rows.map((d) => d.domain)).toEqual(['newer.com', 'older.com']);
  });
});

describe('scanFreshness', () => {
  const now = new Date('2026-10-26T06:00:00Z');

  test('is fresh when the last completed scan is recent', () => {
    const f = scanFreshness([run('2026-10-25T08:00:00Z')], 'supabase', now);
    expect(f).toMatchObject({ lastScanAt: '2026-10-25T08:00:00Z', ageDays: 0, isStale: false, reason: null });
  });

  test('is stale once the last scan is older than the threshold', () => {
    const f = scanFreshness([run('2026-09-14T10:25:18Z')], 'supabase', now);
    expect(f.isStale).toBe(true);
    expect(f.reason).toBe('stale');
    expect(f.ageDays).toBe(41);
  });

  test('threshold allows exactly one missed daily run', () => {
    expect(STALE_AFTER_DAYS).toBe(2);
    expect(scanFreshness([run('2026-10-24T06:00:01Z')], 'supabase', now).isStale).toBe(false);
    expect(scanFreshness([run('2026-10-23T06:00:00Z')], 'supabase', now).isStale).toBe(true);
  });

  test('ignores unfinished runs and uses the newest completed one', () => {
    const f = scanFreshness(
      [run(null, 'running'), run('2026-10-25T08:00:00Z'), run('2026-09-14T10:25:18Z')],
      'supabase',
      now
    );
    expect(f.lastScanAt).toBe('2026-10-25T08:00:00Z');
  });

  test('flags the bundled fixture as stale regardless of its date', () => {
    const f = scanFreshness([run('2026-10-25T08:00:00Z')], 'fixture', now);
    expect(f).toMatchObject({ isStale: true, reason: 'fixture' });
  });

  test('flags a database with no completed scan', () => {
    const f = scanFreshness([], 'supabase', now);
    expect(f).toMatchObject({ lastScanAt: null, ageDays: null, isStale: true, reason: 'no_runs' });
  });
});
