import Link from 'next/link';
import { getDataset } from '@/data/repository';
import { VerdictBadge, RiskMeter, SectionHeading, DomainLink, Stat } from '@/components/primitives';
import { ScanForm } from '@/components/scan-form';
import { SortableTable } from '@/components/sortable-table';
import { SECTION_HELP } from '@/lib/section-help';
import { isoDay } from '@/lib/dates';
import { noLongerActive, scanFreshness } from '@/lib/scan-status';
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
  const gone = noLongerActive(ds.domains);
  const freshness = scanFreshness(ds.runs, ds.source);

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
                <div className="mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-critical)]">
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
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded border border-[var(--color-line-bright)] px-3 text-[12px] font-medium text-[var(--color-ink)] transition-colors duration-150 hover:border-[var(--color-critical)] hover:bg-[var(--color-critical-dim)]"
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
        <SectionHeading count={newest.length} help={{ title: 'Newest registrations', content: SECTION_HELP.newest }}>
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
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
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
        <SectionHeading
          count={live.filter((d) => !d.clusterSlug).length}
          help={{ title: 'Triage queue', content: SECTION_HELP.triage }}
        >
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

      {/* No longer active ---------------------------------------------- */}
      <section aria-labelledby="gone-heading">
        <SectionHeading count={gone.length} help={{ title: 'No longer active', content: SECTION_HELP.gone }}>
          <span id="gone-heading">No longer active — recorded live, now offline</span>
        </SectionHeading>
        {gone.length ? (
          <GoneTable rows={gone} />
        ) : (
          <p className="rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-8 text-center text-[13px] text-[var(--color-ink-faint)]">
            No tracked domain has gone offline yet.
          </p>
        )}
        <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-[var(--color-ink-faint)]">
          Offline means the domain stopped resolving or serving. A takedown, an expiry and a
          deliberate pause look identical from outside, and this page cannot tell who caused it.
          If a domain comes back online it returns to the live lists. &ldquo;Detected offline&rdquo; is
          the first scan that saw it down; it may have gone down at any point since the scan before
          that, so do not quote it as the takedown date.
        </p>
      </section>

      {/* Estate -------------------------------------------------------- */}
      <section aria-labelledby="estate-heading">
        <SectionHeading count={legitimate.length} help={{ title: 'Verified JOOLA estate', content: SECTION_HELP.estate }}>
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

      <p className="mono border-t border-[var(--color-line)] pt-4 text-[12px] text-[var(--color-ink-faint)]">
        {ds.domains.length} domains tracked · source: {ds.source} · last scan{' '}
        {isoDay(freshness.lastScanAt)}
      </p>
    </div>
  );
}

function GoneTable({ rows }: { rows: DomainRecord[] }) {
  return (
    <SortableTable
      caption="Domains recorded live that are now offline"
      minWidth="880px"
      columns={[
        { label: 'Domain' },
        { label: 'Added to DB' },
        { label: 'Registered' },
        { label: 'Detected offline' },
        { label: 'Days since' },
        { label: 'Registrar' },
      ]}
      rows={rows.map((d) => ({
        id: d.domain,
        values: [
          d.domain,
          isoDay(d.firstSeenAt, '') || null,
          d.infrastructure?.registeredAt ?? null,
          isoDay(d.takenDownAt, '') || null,
          daysSince(d.takenDownAt),
          d.infrastructure?.registrarName ?? null,
        ],
        cells: (
          <>
            <td className="px-4 py-3">
              <DomainLink domain={d.domain} className="text-[13px]" />
              {d.clusterSlug && (
                <span className="mono ml-2 rounded bg-[var(--color-critical-dim)] px-1.5 py-0.5 text-[12px] text-[var(--color-critical)]">
                  campaign
                </span>
              )}
            </td>
            <td className="mono px-4 py-3 text-[12px] text-[var(--color-ink-dim)]">
              {isoDay(d.firstSeenAt)}
            </td>
            <td className="mono px-4 py-3 text-[12px] text-[var(--color-ink-dim)]">
              {d.infrastructure?.registeredAt ?? '—'}
            </td>
            <td className="mono px-4 py-3 text-[12px] text-[var(--color-ink)]">
              {isoDay(d.takenDownAt)}
            </td>
            <td className="mono px-4 py-3 text-[12px] tabular-nums text-[var(--color-ink-dim)]">
              {daysSince(d.takenDownAt) ?? '—'}
            </td>
            <td className="px-4 py-3 text-[12px] text-[var(--color-ink-dim)]">
              <span className="block max-w-[220px] truncate" title={d.infrastructure?.registrarName ?? ''}>
                {d.infrastructure?.registrarName ?? '—'}
              </span>
            </td>
          </>
        ),
      }))}
    />
  );
}

function DomainTable({ rows }: { rows: DomainRecord[] }) {
  return (
    <SortableTable
      caption="Domains awaiting manual triage"
      minWidth="760px"
      columns={[
        { label: 'Domain' },
        { label: 'Registered' },
        { label: 'Platform' },
        { label: 'Registrar' },
        { label: 'Risk' },
      ]}
      rows={rows.map((d) => ({
        id: d.domain,
        values: [
          d.domain,
          d.infrastructure?.registeredAt ?? null,
          d.snapshot?.techStack.ecommerce ?? d.snapshot?.techStack.cms ?? null,
          d.infrastructure?.registrarName ?? null,
          d.riskScore,
        ],
        cells: (
          <>
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
          </>
        ),
      }))}
    />
  );
}
