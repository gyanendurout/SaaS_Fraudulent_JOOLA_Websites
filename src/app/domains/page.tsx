import { getDataset } from '@/data/repository';
import { VerdictBadge, RiskMeter, DomainLink, SectionHeading } from '@/components/primitives';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'All domains — JOOLA Brand Protection' };

export default async function DomainsPage() {
  const ds = await getDataset();

  const groups = [
    {
      key: 'campaign',
      title: 'Known campaign',
      rows: ds.domains.filter((d) => d.clusterSlug),
    },
    {
      key: 'triage',
      title: 'Awaiting triage',
      rows: ds.domains.filter(
        (d) => !d.clusterSlug && d.classification !== 'legitimate' && d.isLive
      ),
    },
    {
      key: 'offline',
      title: 'Not serving traffic',
      rows: ds.domains.filter(
        (d) => !d.clusterSlug && d.classification !== 'legitimate' && !d.isLive
      ),
    },
    {
      key: 'estate',
      title: 'Verified JOOLA estate',
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
          <SectionHeading count={g.rows.length}>
            <span id={`${g.key}-heading`}>{g.title}</span>
          </SectionHeading>
          <div className="overflow-x-auto rounded border border-[var(--color-line)]">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <caption className="sr-only">{g.title}</caption>
              <thead>
                <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
                  {['Domain', 'Registered', 'Platform', 'Builder', 'Abuse contact', 'Status', 'Risk'].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        className="mono px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-faint)]"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {g.rows.map((d) => (
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
                    <td
                      className={`mono px-4 py-3 text-[12px] ${
                        d.snapshot?.techStack.pageBuilderVersion === '3.35.6'
                          ? 'text-[var(--color-critical)]'
                          : 'text-[var(--color-ink-dim)]'
                      }`}
                    >
                      {d.snapshot?.techStack.pageBuilderVersion ?? '—'}
                    </td>
                    <td className="mono px-4 py-3 text-[11px] text-[var(--color-ink-dim)]">
                      <span
                        className="block max-w-[190px] truncate"
                        title={d.infrastructure?.registrarAbuseEmail ?? ''}
                      >
                        {d.infrastructure?.registrarAbuseEmail ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <VerdictBadge verdict={d.verdict} />
                    </td>
                    <td className="px-4 py-3">
                      <RiskMeter score={d.riskScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
