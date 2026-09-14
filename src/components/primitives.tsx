import Link from 'next/link';
import type { Verdict } from '@/lib/fingerprint';

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
  const pad = size === 'lg' ? 'px-3 py-1.5 text-[13px]' : 'px-2 py-0.5 text-[11px]';
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
}: {
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="mono text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
        {children}
        {count !== undefined && (
          <span className="ml-2 text-[var(--color-ink-dim)] tabular-nums">{count}</span>
        )}
      </h2>
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
      <dt className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
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
      <div className="mt-1.5 text-[11px] leading-tight text-[var(--color-ink-faint)]">{label}</div>
    </div>
  );
}
