import { describe, test, expect } from 'vitest';
import { isoDay, monthSpan } from './dates';

describe('isoDay', () => {
  test('returns the stored calendar day of a UTC timestamp', () => {
    expect(isoDay('2026-07-20T00:00:00Z')).toBe('2026-07-20');
  });

  test('does not shift the day under a non-UTC timezone', () => {
    // The regression: `new Date('2026-07-20T00:00:00Z').getDate()` yields the
    // 20th in UTC but the 19th anywhere west of it, and the reverse for a late
    // evening timestamp read from Asia/Kolkata. Reading the string cannot shift.
    const original = process.env.TZ;
    try {
      for (const tz of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        expect(isoDay('2026-07-20T00:00:00Z')).toBe('2026-07-20');
        expect(isoDay('2026-08-27T23:59:59+05:30')).toBe('2026-08-27');
      }
    } finally {
      process.env.TZ = original;
    }
  });

  test('accepts a bare DATE with no time component', () => {
    expect(isoDay('2026-08-27')).toBe('2026-08-27');
  });

  test('renders the fallback for absent dates', () => {
    expect(isoDay(null)).toBe('—');
    expect(isoDay(undefined)).toBe('—');
    expect(isoDay('')).toBe('—');
  });

  test('renders the fallback rather than inventing a date from junk', () => {
    expect(isoDay('not a date')).toBe('—');
    expect(isoDay('20-07-2026')).toBe('—');
  });

  test('honours a caller-supplied fallback', () => {
    expect(isoDay(null, 'never')).toBe('never');
  });
});

describe('monthSpan', () => {
  test('names a single month when every date falls in it', () => {
    expect(monthSpan(['2026-07-20', '2026-07-23'])).toBe('Jul 2026');
  });

  test('spans first to latest month, ignoring input order', () => {
    expect(monthSpan(['2026-09-28', '2026-07-20', '2026-08-27'])).toBe('Jul–Sep 2026');
  });

  test('includes both years when the span crosses a year', () => {
    expect(monthSpan(['2025-12-01', '2026-02-10'])).toBe('Dec 2025–Feb 2026');
  });

  test('skips missing or unusable dates rather than inventing one', () => {
    expect(monthSpan(['2026-07-20', null, 'junk'])).toBe('Jul 2026');
    expect(monthSpan([null])).toBeNull();
  });
});
