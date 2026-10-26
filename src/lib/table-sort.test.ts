import { describe, test, expect } from 'vitest';
import { sortRows, nextDirection } from './table-sort';

const rows = [
  { id: 'b', values: ['joola-b.com', 40, '2026-07-22'] },
  { id: 'a', values: ['joola-a.com', 100, null] },
  { id: 'c', values: ['joola-c.com', 5, '2026-08-27'] },
];
const ids = (r: typeof rows) => r.map((x) => x.id);

describe('sortRows', () => {
  test('returns the original order when no column is sorted', () => {
    expect(ids(sortRows(rows, null, 'asc'))).toEqual(['b', 'a', 'c']);
  });

  test('sorts numbers numerically, not as text', () => {
    expect(ids(sortRows(rows, 1, 'asc'))).toEqual(['c', 'b', 'a']);
    expect(ids(sortRows(rows, 1, 'desc'))).toEqual(['a', 'b', 'c']);
  });

  test('sorts text alphabetically', () => {
    expect(ids(sortRows(rows, 0, 'asc'))).toEqual(['a', 'b', 'c']);
  });

  test('sorts ISO dates chronologically', () => {
    expect(ids(sortRows(rows, 2, 'asc')).slice(0, 2)).toEqual(['b', 'c']);
  });

  test('keeps missing values last in both directions', () => {
    expect(ids(sortRows(rows, 2, 'asc')).at(-1)).toBe('a');
    expect(ids(sortRows(rows, 2, 'desc')).at(-1)).toBe('a');
  });

  test('does not mutate the input', () => {
    sortRows(rows, 1, 'asc');
    expect(ids(rows)).toEqual(['b', 'a', 'c']);
  });
});

describe('nextDirection', () => {
  test('a new column starts ascending', () => {
    expect(nextDirection(0, 1, 'asc')).toEqual({ column: 1, direction: 'asc' });
  });

  test('the same column flips direction', () => {
    expect(nextDirection(1, 1, 'asc')).toEqual({ column: 1, direction: 'desc' });
    expect(nextDirection(1, 1, 'desc')).toEqual({ column: 1, direction: 'asc' });
  });
});
