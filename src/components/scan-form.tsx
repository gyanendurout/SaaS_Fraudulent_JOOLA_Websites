'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { matchBrandDomain } from '@/lib/domain-match';

type Status =
  | { kind: 'idle' }
  | { kind: 'error'; message: string; hint?: string }
  | { kind: 'checking' };

export function ScanForm() {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = value.trim();
    if (!raw) {
      setStatus({ kind: 'error', message: 'Enter a URL or domain to investigate.' });
      return;
    }

    const match = matchBrandDomain(raw);
    if (!match) {
      setStatus({
        kind: 'error',
        message: 'No JOOLA token found in the domain name.',
        hint:
          'The brand must appear in the domain itself (joola-vietnam.com), not in a path or query ' +
          'parameter (example.com/?ref=joola). Marketplace listings are a separate workflow.',
      });
      return;
    }

    setStatus({ kind: 'checking' });
    startTransition(() => {
      router.push(`/domain/${match.registrableDomain}`);
    });
  }

  const busy = pending || status.kind === 'checking';
  const invalid = status.kind === 'error';

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="scan-url" className="sr-only">
        URL or domain to investigate
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="scan-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://joola-vietnam.com"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (status.kind === 'error') setStatus({ kind: 'idle' });
          }}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'scan-error' : 'scan-help'}
          className={`mono min-h-11 flex-1 rounded border bg-[var(--color-surface)] px-3.5 py-2.5 text-[14px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] transition-colors duration-150 ${
            invalid
              ? 'border-[var(--color-critical)]'
              : 'border-[var(--color-line-bright)] hover:border-[var(--color-ink-faint)]'
          }`}
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 cursor-pointer rounded bg-[var(--color-ink)] px-5 text-[14px] font-medium text-[var(--color-void)] transition-opacity duration-150 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Opening…' : 'Investigate'}
        </button>
      </div>

      {invalid ? (
        <p
          id="scan-error"
          role="alert"
          className="mt-2 text-[12px] leading-relaxed text-[var(--color-critical)]"
        >
          {status.message}
          {status.hint && (
            <span className="mt-1 block text-[var(--color-ink-dim)]">{status.hint}</span>
          )}
        </p>
      ) : (
        <p id="scan-help" className="mt-2 text-[12px] text-[var(--color-ink-faint)]">
          Accepts a full URL or a bare domain.
        </p>
      )}
    </form>
  );
}
