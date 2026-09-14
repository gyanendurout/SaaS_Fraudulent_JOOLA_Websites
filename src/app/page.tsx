import Link from 'next/link';
import { getDataset } from '@/data/repository';
import { VerdictBadge, RiskMeter, SectionHeading, DomainLink, Stat } from '@/components/primitives';
import { ScanForm } from '@/components/scan-form';
import type { DomainRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export default async function OverviewPage() {
  const ds = await getDataset();

  const live = ds.domains.filter((d) => d.isLive && d.classification !== 'legitimate');
  const cluster = ds.clusters[0];
  const clusterMembers = ds.domains.filter((d) => d.clusterSlug === cluster?.slug);
  const clusterLive = clusterMembers.filter((d) => d.isLive);
  const legitimate = ds.domains.filter((d) => d.classification === 'legitimate');
  const triage = live.filter((d) => !d.clusterSlug).slice(0, 12);

  // "What came newly into the market" — ordered by registration recency.
  const newest = [...ds.domains]
    .filter((d) => d.classification !== 'legitimate' && d.infrastructure?.registeredAt)
    .sort((a, b) =>
      (b.infrastructure!.registeredAt ?? '').localeCompare(a.infrastructure!.registeredAt ?? '')
    )
    .slice(0, 6);

  return (
    <div className="space-y-12">
      {/* Scan bar ------------------------------------------------------ */}
      <section aria-labelledby="scan-heading">
        <h1
          id="scan-heading"
          className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[32px]"
        >
          Investigate a suspect domain
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-dim)]">
          Paste a URL. Cached results return instantly; unknown domains are enriched from registry,
          DNS and platform fingerprint data. The brand token is matched against domain labels only —
          never a path or query parameter.
        </p>
        <div className="mt-5 max-w-2xl">
          <ScanForm />
        </div>
      </section>

      {/* Campaign banner ---------------------------------------------- */}
      {cluster && (
        <section
          aria-labelledby="campaign-heading"
          className="relative overflow-hidden rounded-lg border border-[var(--color-critical)]/35 bg-[var(--color-critical-dim)]/35"
        >
          <div className="relative px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-critical)]">
                  Active campaign
                </div>
                <h2
                  id="campaign-heading"
                  className="mt-1.5 text-[19px] font-semibold leading-snug text-[var(--color-ink)]"
                >
                  {cluster.label}
                </h2>
              </div>
              <Link
                href={`/cluster/${cluster.slug}`}
                className="shrink-0 cursor-pointer rounded border border-[var(--color-line-bright)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-ink)] transition-colors duration-150 hover:border-[var(--color-critical)] hover:bg-[var(--color-critical-dim)]"
              >
                Open campaign →
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-12 gap-y-5">
              <Stat value={clusterLive.length} label="Live sites" tone="critical" />
              <Stat value={clusterMembers.length} label="Domains in cluster" />
              <Stat
                value={String(cluster.fingerprint.page_builder_version ?? '—')}
                label="Shared Elementor build"
              />
              <Stat
                value={(cluster.fingerprint.registrar_abuse_contacts as string[])?.length ?? 0}
                label="Registrars used"
              />
            </div>

            <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-[var(--color-ink-dim)]">
              {cluster.notes}
            </p>
          </div>
        </section>
      )}

      {/* Newly registered --------------------------------------------- */}
      <section aria-labelledby="new-heading">
        <SectionHeading count={newest.length}>
          <span id="new-heading">Newest registrations</span>
        </SectionHeading>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {newest.map((d) => {
            const age = daysSince(d.infrastructure?.registeredAt);
            return (
              <li
                key={d.domain}
                className="rounded border border-[var(--color-line)] bg-[var(--color-surface)] p-4 transition-colors duration-150 hover:border-[var(--color-line-bright)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <DomainLink domain={d.domain} className="text-[13px]" />
                  <VerdictBadge verdict={d.verdict} />
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
                  <div>
                    <dt className="inline text-[var(--color-ink-faint)]">Registered </dt>
                    <dd className="mono inline text-[var(--color-ink-dim)]">
                      {d.infrastructure?.registeredAt}
                      {age !== null && age < 90 && (
                        <span className="ml-1.5 text-[var(--color-warn)]">{age}d old</span>
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <RiskMeter score={d.riskScore} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Triage queue -------------------------------------------------- */}
      <section aria-labelledby="triage-heading">
        <SectionHeading count={live.filter((d) => !d.clusterSlug).length}>
          <span id="triage-heading">Triage queue — live, outside the known campaign</span>
        </SectionHeading>
        {triage.length ? (
          <DomainTable rows={triage} />
        ) : (
          <p className="rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-8 text-center text-[13px] text-[var(--color-ink-faint)]">
            Nothing awaiting triage.
          </p>
        )}
      </section>

      {/* Estate -------------------------------------------------------- */}
      <section aria-labelledby="estate-heading">
        <SectionHeading count={legitimate.length}>
          <span id="estate-heading">Verified JOOLA estate — excluded from reporting</span>
        </SectionHeading>
        <ul className="flex flex-wrap gap-2">
          {legitimate.map((d) => (
            <li key={d.domain}>
              <Link
                href={`/domain/${d.domain}`}
                className="mono inline-flex cursor-pointer items-center gap-2 rounded border border-[var(--color-safe)]/30 bg-[var(--color-safe-dim)] px-2.5 py-1 text-[12px] text-[var(--color-ink)] transition-colors duration-150 hover:border-[var(--color-safe)]"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-safe)]" />
                {d.domain}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mono border-t border-[var(--color-line)] pt-4 text-[11px] text-[var(--color-ink-faint)]">
        {ds.domains.length} domains tracked · source: {ds.source} · generated{' '}
        {new Date(ds.generatedAt).toISOString().slice(0, 16).replace('T', ' ')}Z
      </p>
    </div>
  );
}

function DomainTable({ rows }: { rows: DomainRecord[] }) {
  return (
    <div className="overflow-x-auto rounded border border-[var(--color-line)]">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <caption className="sr-only">Domains awaiting manual triage</caption>
        <thead>
          <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
            {['Domain', 'Registered', 'Platform', 'Registrar', 'Risk'].map((h) => (
              <th
                key={h}
                scope="col"
                className="mono px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-faint)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr
              key={d.domain}
              className="border-b border-[var(--color-line)] last:border-0 transition-colors duration-150 hover:bg-[var(--color-surface)]"
            >
              <td className="px-4 py-3">
                <DomainLink domain={d.domain} className="text-[13px]" />
              </td>
              <td className="mono px-4 py-3 text-[12px] text-[var(--color-ink-dim)]">
                {d.infrastructure?.registeredAt ?? '—'}
              </td>
              <td className="px-4 py-3 text-[12px] text-[var(--color-ink-dim)]">
                {d.snapshot?.techStack.ecommerce ?? d.snapshot?.techStack.cms ?? '—'}
              </td>
              <td className="px-4 py-3 text-[12px] text-[var(--color-ink-dim)]">
                <span className="block max-w-[220px] truncate" title={d.infrastructure?.registrarName ?? ''}>
                  {d.infrastructure?.registrarName ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3">
                <RiskMeter score={d.riskScore} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
