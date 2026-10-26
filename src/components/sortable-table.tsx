'use client';

import { useState } from 'react';
import { nextDirection, sortRows, type SortDirection, type SortValue } from '@/lib/table-sort';

export interface Column {
  label: string;
  /** Columns without a meaningful order (e.g. a link) are not sortable. */
  sortable?: boolean;
}

export interface Row {
  id: string;
  values: SortValue[];
  /** The row's `<td>` cells, rendered by the server page. */
  cells: React.ReactNode;
}

/**
 * Click a header to sort ascending, again for descending. Until then rows keep
 * the server's order (most threatening first). `aria-sort` tells screen
 * readers the current order.
 */
export function SortableTable({
  caption,
  columns,
  rows,
  minWidth,
}: {
  caption: string;
  columns: Column[];
  rows: Row[];
  minWidth: string;
}) {
  const [sort, setSort] = useState<{ column: number | null; direction: SortDirection }>({
    column: null,
    direction: 'asc',
  });
  const sorted = sortRows(rows, sort.column, sort.direction);

  return (
    <div className="overflow-x-auto rounded border border-[var(--color-line)]">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        <caption className="sr-only">{caption}. Column headers with arrows can be sorted.</caption>
        <thead>
          <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
            {columns.map((c, i) => {
              const active = sort.column === i;
              const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined;
              const label = 'mono text-[11px] font-medium uppercase tracking-[0.14em]';
              return (
                <th key={c.label} scope="col" aria-sort={ariaSort} className="px-2 py-1">
                  {c.sortable === false ? (
                    <span className={`${label} inline-flex min-h-10 items-center px-2 text-[var(--color-ink-faint)]`}>
                      {c.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSort(nextDirection(sort.column, i, sort.direction))}
                      className={`${label} inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded px-2 transition-colors duration-150 hover:bg-[var(--color-raised)] ${
                        active ? 'text-[var(--color-info)]' : 'text-[var(--color-ink-faint)]'
                      }`}
                    >
                      {c.label}
                      <SortIcon state={active ? sort.direction : null} />
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.id}
              className="border-b border-[var(--color-line)] last:border-0 transition-colors duration-150 hover:bg-[var(--color-surface)]"
            >
              {r.cells}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({ state }: { state: SortDirection | null }) {
  return (
    <svg aria-hidden viewBox="0 0 10 14" className="h-3 w-2.5" fill="currentColor">
      <path d="M5 1 9 5.5H1z" opacity={state === 'asc' ? 1 : 0.35} />
      <path d="M5 13 1 8.5h8z" opacity={state === 'desc' ? 1 : 0.35} />
    </svg>
  );
}
