'use client';

import { useState } from 'react';
import type { TakedownDraft } from '@/lib/takedown';

const PRIORITY_STYLE = {
  immediate: {
    label: 'Do first',
    className: 'border-[var(--color-critical)]/40 bg-[var(--color-critical-dim)]/40',
    badge: 'text-[var(--color-critical)]',
  },
  high: {
    label: 'High',
    className: 'border-[var(--color-warn)]/30 bg-[var(--color-surface)]',
    badge: 'text-[var(--color-warn)]',
  },
  standard: {
    label: 'Standard',
    className: 'border-[var(--color-line)] bg-[var(--color-surface)]',
    badge: 'text-[var(--color-ink-faint)]',
  },
} as const;

export function TakedownPack({ drafts }: { drafts: TakedownDraft[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [copied, setCopied] = useState<number | null>(null);

  async function copy(index: number, draft: TakedownDraft) {
    const text = `To: ${draft.recipient}\nSubject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      window.setTimeout(() => setCopied((c) => (c === index ? null : c)), 2500);
    } catch {
      setCopied(-1);
      window.setTimeout(() => setCopied(null), 2500);
    }
  }

  return (
    <div className="space-y-3">
      {drafts.map((draft, index) => {
        const style = PRIORITY_STYLE[draft.priority];
        const isOpen = openIndex === index;
        const panelId = `takedown-panel-${index}`;
        const buttonId = `takedown-button-${index}`;

        return (
          <div key={draft.channel + index} className={`rounded border ${style.className}`}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[var(--color-raised)]/50"
              >
                <span
                  aria-hidden
                  className={`mono text-[11px] transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                >
                  ▸
                </span>
                <span className="flex-1 text-[14px] font-medium text-[var(--color-ink)]">
                  {draft.title}
                </span>
                <span
                  className={`mono text-[10px] uppercase tracking-[0.14em] ${style.badge}`}
                >
                  {style.label}
                </span>
              </button>
            </h3>

            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen}>
              <div className="border-t border-[var(--color-line)] px-4 py-4">
                {draft.note && (
                  <p className="mb-3 text-[12px] leading-relaxed text-[var(--color-warn)]">
                    {draft.note}
                  </p>
                )}

                <dl className="mb-3 grid gap-2 text-[12px] sm:grid-cols-[max-content_1fr]">
                  <dt className="mono text-[var(--color-ink-faint)]">To</dt>
                  <dd className="mono break-all text-[var(--color-ink)]">{draft.recipient}</dd>
                  <dt className="mono text-[var(--color-ink-faint)]">Submit via</dt>
                  <dd className="mono break-all">
                    {/*
                      Only web submissions open in a new tab. A mailto: handed to
                      target="_blank" leaves an empty tab behind once the mail
                      client takes over.
                    */}
                    <a
                      href={draft.submitVia}
                      {...(draft.submitVia.startsWith('http')
                        ? { target: '_blank', rel: 'noreferrer noopener' }
                        : {})}
                      className="cursor-pointer text-[var(--color-info)] underline decoration-dotted underline-offset-4"
                    >
                      {draft.submitVia}
                    </a>
                  </dd>
                  <dt className="mono text-[var(--color-ink-faint)]">Subject</dt>
                  <dd className="text-[var(--color-ink)]">{draft.subject}</dd>
                </dl>

                <pre className="mono max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--color-line)] bg-[var(--color-void)] p-3.5 text-[11.5px] leading-relaxed text-[var(--color-ink-dim)]">
                  {draft.body}
                </pre>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => copy(index, draft)}
                    className="min-h-9 cursor-pointer rounded border border-[var(--color-line-bright)] px-3 text-[12px] font-medium text-[var(--color-ink)] transition-colors duration-150 hover:border-[var(--color-ink-faint)] hover:bg-[var(--color-raised)]"
                  >
                    Copy complaint
                  </button>
                  <span role="status" aria-live="polite" className="text-[12px]">
                    {copied === index && (
                      <span className="text-[var(--color-safe)]">Copied to clipboard</span>
                    )}
                    {copied === -1 && (
                      <span className="text-[var(--color-critical)]">
                        Clipboard unavailable — select the text above
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <p className="text-[11px] leading-relaxed text-[var(--color-ink-faint)]">
        Drafts state only what the stored evidence supports. Confirmed-fraud language is used solely
        where transactional evidence exists; everything else is reported as trademark infringement
        and impersonation. Add trademark registration numbers before sending.
      </p>
    </div>
  );
}
