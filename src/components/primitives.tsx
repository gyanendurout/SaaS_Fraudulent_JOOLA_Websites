import Link from 'next/link';
import type { Verdict } from '@/lib/fingerprint';
import type { ScanFreshness } from '@/lib/scan-status';
import { isoDay } from '@/lib/dates';
import type { SectionHelp } from '@/lib/section-help';
import { InfoTip } from './info-tip';

/* ------------------------------------------------------------------ *
 * Verdict badge — colour is semantic and always paired with text, so
 * meaning never depends on colour alone.
 * ------------------------------------------------------------------ */

const VERDICT_STYLE: Record<Verdict, { label: string; fg: string; bg: string; dot: string }> = {
  confirmed_fraud: {
    label: 'Confirmed fraud',
    fg: 'text-[var(--color-critical)]',
    bg: 'bg-[var(--color-critical-dim)]',
    dot: 'bg-[var(--color-critical)]',
  },
  high_risk: {
    label: 'High risk',
    fg: 'text-[var(--color-critical)]',
    bg: 'bg-[var(--color-critical-dim)]',
    dot: 'bg-[var(--color-critical)]',
  },
  suspicious: {
    label: 'Suspicious',
    fg: 'text-[var(--color-warn)]',
    bg: 'bg-[var(--color-warn-dim)]',
    dot: 'bg-[var(--color-warn)]',
  },
  low_risk: {
    label: 'Low risk',
    fg: 'text-[var(--color-ink-dim)]',
    bg: 'bg-[var(--color-raised)]',
    dot: 'bg-[var(--color-ink-faint)]',
  },
  legitimate: {
    label: 'Legitimate',
    fg: 'text-[var(--color-safe)]',
    bg: 'bg-[var(--color-safe-dim)]',
    dot: 'bg-[var(--color-safe)]',
  },
  unreachable: {
    label: 'Offline',
    fg: 'text-[var(--color-ink-faint)]',
    bg: 'bg-[var(--color-raised)]',
    dot: 'bg-[var(--color-ink-faint)]',
  },
};

export function VerdictBadge({ verdict, size = 'sm' }: { verdict: Verdict; size?: 'sm' | 'lg' }) {
  const s = VERDICT_STYLE[verdict];
  const pad = size === 'lg' ? 'px-3 py-1.5 text-[13px]' : 'px-2 py-0.5 text-[12px]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${s.bg} ${s.fg} ${pad} font-medium whitespace-nowrap`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Risk meter — a bar plus the number. Never the bar alone.
 * ------------------------------------------------------------------ */

export function RiskMeter({ score, className = '' }: { score: number; className?: string }) {
  const tone =
    score >= 70
      ? 'bg-[var(--color-critical)]'
      : score >= 40
        ? 'bg-[var(--color-warn)]'
        : score > 0
          ? 'bg-[var(--color-ink-faint)]'
          : 'bg-[var(--color-safe)]';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="h-1 w-16 overflow-hidden rounded-full bg-[var(--color-line)]"
        role="img"
        aria-label={`Risk score ${score} out of 100`}
      >
        <div className={`h-full ${tone}`} style={{ width: `${Math.max(score, 2)}%` }} />
      </div>
      <span className="mono text-[12px] tabular-nums text-[var(--color-ink-dim)]">{score}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Layout primitives
 * ------------------------------------------------------------------ */

export function SectionHeading({
  children,
  count,
  action,
  help,
}: {
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  /** Plain-English explanation; `title` names the section for screen readers. */
  help?: { title: string; content: SectionHelp };
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <h2 className="mono text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
          {children}
          {count !== undefined && (
            <span className="ml-2 text-[var(--color-ink-dim)] tabular-nums">{count}</span>
          )}
        </h2>
        {help && <InfoTip title={help.title} help={help.content} />}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  children,
  mono = true,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-[13px] text-[var(--color-ink)] ${mono ? 'mono' : ''}`}
      >
        {children ?? <span className="text-[var(--color-ink-faint)]">—</span>}
      </dd>
    </div>
  );
}

export function DomainLink({ domain, className = '' }: { domain: string; className?: string }) {
  return (
    <Link
      href={`/domain/${domain}`}
      className={`mono cursor-pointer text-[var(--color-ink)] underline decoration-[var(--color-line-bright)] decoration-dotted underline-offset-4 transition-colors duration-150 hover:decoration-[var(--color-info)] hover:text-[var(--color-info)] ${className}`}
    >
      {domain}
    </Link>
  );
}

/**
 * Opens the live site in a new tab. `noreferrer` matters here: without it the
 * operator's server logs would show this dashboard's URL as the referrer, and
 * `noopener` stops their page from scripting this tab.
 */
export function VisitSiteLink({ domain }: { domain: string }) {
  return (
    <a
      href={`https://${domain}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${domain} in a new tab`}
      className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded px-2 text-[12px] text-[var(--color-ink-dim)] transition-colors duration-150 hover:bg-[var(--color-raised)] hover:text-[var(--color-info)]"
    >
      Open
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 3h4v4M13 3 7 9M11 9.5V13H3V5h3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

/* ------------------------------------------------------------------ *
 * Scan status — when the data was last refreshed, and a warning when it
 * cannot be treated as current. Text always carries the meaning.
 * ------------------------------------------------------------------ */

const STALE_REASON: Record<NonNullable<ScanFreshness['reason']>, string> = {
  stale: 'scan overdue',
  fixture: 'database unavailable — showing bundled snapshot',
  no_runs: 'no completed scan recorded',
};

export function ScanStatus({ freshness }: { freshness: ScanFreshness }) {
  const { lastScanAt, ageDays, isStale, reason } = freshness;
  return (
    <p
      className={`mono inline-flex flex-wrap items-center gap-x-2 text-[12px] ${
        isStale ? 'text-[var(--color-warn)]' : 'text-[var(--color-ink-dim)]'
      }`}
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${isStale ? 'bg-[var(--color-warn)]' : 'bg-[var(--color-safe)]'}`}
      />
      <span>
        Last scan {isoDay(lastScanAt)}
        {ageDays !== null && ` · ${ageDays === 0 ? 'today' : `${ageDays}d ago`}`}
      </span>
      {reason && <span>· {STALE_REASON[reason]}</span>}
    </p>
  );
}

export function Stat({
  value,
  label,
  tone = 'default',
}: {
  value: string | number;
  label: string;
  tone?: 'default' | 'critical' | 'warn' | 'safe';
}) {
  const toneClass = {
    default: 'text-[var(--color-ink)]',
    critical: 'text-[var(--color-critical)]',
    warn: 'text-[var(--color-warn)]',
    safe: 'text-[var(--color-safe)]',
  }[tone];
  return (
    <div>
      <div className={`mono text-[30px] font-bold leading-none tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[12px] leading-tight text-[var(--color-ink-faint)]">{label}</div>
    </div>
  );
}
