import { getDataset } from '@/data/repository';
import { VerdictBadge, RiskMeter, DomainLink, SectionHeading, VisitSiteLink } from '@/components/primitives';
import { SortableTable } from '@/components/sortable-table';
import { isoDay } from '@/lib/dates';
import { SECTION_HELP } from '@/lib/section-help';
import type { Verdict } from '@/lib/fingerprint';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'All domains — JOOLA Brand Protection' };

/** Sort order for the Status column: higher is more severe. */
const VERDICT_RANK: Record<Verdict, number> = {
  confirmed_fraud: 5,
  high_risk: 4,
  suspicious: 3,
  low_risk: 2,
  unreachable: 1,
  legitimate: 0,
};

const COLUMNS = [
  { label: 'Domain' },
  { label: 'Website', sortable: false },
  { label: 'Added to DB' },
  { label: 'Registered' },
  { label: 'Platform' },
  { label: 'Builder' },
  { label: 'Abuse contact' },
  { label: 'Status' },
  { label: 'Risk' },
];

export default async function DomainsPage() {
  const ds = await getDataset();

  const groups = [
    {
      key: 'campaign',
      title: 'Known campaign',
      help: SECTION_HELP.campaign,
      rows: ds.domains.filter((d) => d.clusterSlug),
    },
    {
      key: 'triage',
      title: 'Awaiting triage',
      help: SECTION_HELP.domainsTriage,
      rows: ds.domains.filter(
        (d) => !d.clusterSlug && d.classification !== 'legitimate' && d.isLive
      ),
    },
    {
      // takenDownAt is stamped only on a recorded live -> offline transition.
      key: 'gone',
      title: 'No longer active (was live)',
      help: SECTION_HELP.domainsGone,
      rows: ds.domains.filter(
        (d) => !d.clusterSlug && d.classification !== 'legitimate' && !d.isLive && d.takenDownAt
      ),
    },
    {
      key: 'never',
      title: 'Never served',
      help: SECTION_HELP.domainsNever,
      rows: ds.domains.filter(
        (d) => !d.clusterSlug && d.classification !== 'legitimate' && !d.isLive && !d.takenDownAt
      ),
    },
    {
      key: 'estate',
      title: 'Verified JOOLA estate',
      help: SECTION_HELP.domainsEstate,
      rows: ds.domains.filter((d) => d.classification === 'legitimate'),
    },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-[24px] font-semibold leading-tight sm:text-[30px]">Tracked domains</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-dim)]">
          Every domain where the JOOLA token appears in the domain labels, grouped by disposition.
          {' '}
          {ds.domains.length} tracked from {ds.runs[0]?.candidatesTested ?? 0} candidates tested.
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`${g.key}-heading`}>
          <SectionHeading count={g.rows.length} help={{ title: g.title, content: g.help }}>
            <span id={`${g.key}-heading`}>{g.title}</span>
          </SectionHeading>
          <SortableTable
            caption={g.title}
            columns={COLUMNS}
            minWidth="1180px"
            rows={g.rows.map((d) => ({
              id: d.domain,
              values: [
                d.domain,
                null,
                isoDay(d.firstSeenAt, '') || null,
                d.infrastructure?.registeredAt ?? null,
                d.snapshot?.techStack.ecommerce ?? d.snapshot?.techStack.cms ?? null,
                d.snapshot?.techStack.pageBuilderVersion ?? null,
                d.infrastructure?.registrarAbuseEmail ?? null,
                VERDICT_RANK[d.verdict],
                d.riskScore,
              ],
              cells: (
                <>
                  <td className="px-4 py-3">
                    <DomainLink domain={d.domain} className="text-[13px]" />
                  </td>
                  <td className="px-2 py-1">
                    <VisitSiteLink domain={d.domain} />
                  </td>
                  <td className="mono px-4 py-3 text-[12px] text-[var(--color-ink-dim)]">
                    {isoDay(d.firstSeenAt)}
                  </td>
                  <td className="mono px-4 py-3 text-[12px] text-[var(--color-ink-dim)]">
                    {d.infrastructure?.registeredAt ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[var(--color-ink-dim)]">
                    {d.snapshot?.techStack.ecommerce ?? d.snapshot?.techStack.cms ?? '—'}
                  </td>
                  <td
                    className={`mono px-4 py-3 text-[12px] ${
                      d.snapshot?.techStack.pageBuilderVersion === '3.35.6'
                        ? 'text-[var(--color-critical)]'
                        : 'text-[var(--color-ink-dim)]'
                    }`}
                  >
                    {d.snapshot?.techStack.pageBuilderVersion ?? '—'}
                  </td>
                  <td className="mono px-4 py-3 text-[12px] text-[var(--color-ink-dim)]">
                    <span
                      className="block max-w-[190px] truncate"
                      title={d.infrastructure?.registrarAbuseEmail ?? ''}
                    >
                      {d.infrastructure?.registrarAbuseEmail ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <VerdictBadge verdict={d.verdict} />
                    {d.takenDownAt && (
                      <span className="mono mt-1 block text-[11px] text-[var(--color-ink-faint)]">
                        offline since {isoDay(d.takenDownAt)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RiskMeter score={d.riskScore} />
                  </td>
                </>
              ),
            }))}
          />
        </section>
      ))}
    </div>
  );
}
