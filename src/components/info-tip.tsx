'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { SectionHelp } from '@/lib/section-help';

/**
 * Click-to-open explanation for a section. A click (not hover) so it works on
 * touch screens and stays open while it is read; Escape or a click outside
 * closes it.
 */
export function InfoTip({ title, help }: { title: string; help: SectionHelp }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`What does “${title}” show?`}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex size-10 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--color-raised)] hover:text-[var(--color-info)] ${
          open ? 'bg-[var(--color-raised)] text-[var(--color-info)]' : 'text-[var(--color-ink)]'
        }`}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.2v4" strokeLinecap="round" />
          <circle cx="8" cy="4.8" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={`About ${title}`}
          className="absolute left-0 top-full z-20 mt-1 w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-[var(--color-line-bright)] bg-[var(--color-raised)] p-4 text-left shadow-2xl shadow-black/60"
        >
          <p className="text-[13px] leading-relaxed text-[var(--color-ink)]">{help.summary}</p>
          {help.columns && (
            <dl className="mt-3 space-y-2 border-t border-[var(--color-line)] pt-3">
              {help.columns.map((c) => (
                <div key={c.name}>
                  <dt className="text-[12px] font-semibold text-[var(--color-ink)]">{c.name}</dt>
                  <dd className="text-[12px] leading-relaxed text-[var(--color-ink)]">{c.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
          {help.note && (
            <p className="mt-3 border-t border-[var(--color-line)] pt-3 text-[12px] leading-relaxed text-[var(--color-warn)]">
              {help.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
