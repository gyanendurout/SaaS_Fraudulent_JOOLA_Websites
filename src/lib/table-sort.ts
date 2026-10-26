/**
 * Column sorting for the evidence tables. Pure, so it is unit-tested apart
 * from the React component that uses it.
 */

export type SortValue = string | number | null;
export type SortDirection = 'asc' | 'desc';

export interface SortableRow {
  id: string;
  /** One sort key per column, in column order. */
  values: SortValue[];
}

/**
 * Rows ordered by one column. Missing values always go last, in either
 * direction — a blank registrar is not "smaller" than a real one. Dates are
 * compared as ISO strings, which order chronologically without a `Date`.
 */
export function sortRows<T extends SortableRow>(
  rows: T[],
  column: number | null,
  direction: SortDirection
): T[] {
  if (column === null) return rows;
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a.values[column];
    const y = b.values[column];
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    const cmp =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), undefined, { numeric: true });
    return cmp * sign;
  });
}

export function nextDirection(
  current: number | null,
  clicked: number,
  direction: SortDirection
): { column: number; direction: SortDirection } {
  if (current !== clicked) return { column: clicked, direction: 'asc' };
  return { column: clicked, direction: direction === 'asc' ? 'desc' : 'asc' };
}
