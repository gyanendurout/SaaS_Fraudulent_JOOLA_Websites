import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDataset } from '@/data/repository';
import { VerdictBadge, SectionHeading, Stat, DomainLink } from '@/components/primitives';

export const dynamic = 'force-dynamic';

export default async function ClusterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ds = await getDataset();
  const cluster = ds.clusters.find((c) => c.slug === slug);
  if (!cluster) notFound();

  const members = ds.domains
    .filter((d) => d.clusterSlug === cluster.slug)
    .sort((a, b) =>
      (a.infrastructure?.registeredAt ?? '').localeCompare(b.infrastructure?.registeredAt ?? '')
    );

  const live = members.filter((d) => d.isLive);
  const registrars = new Map<string, string[]>();
  for (const m of members) {
    const email = m.infrastructure?.registrarAbuseEmail;
    if (!email) continue;
    registrars.set(email, [...(registrars.get(email) ?? []), m.domain]);
  }

  return (
    <div className="space-y-10">
      <header>
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href="/"
            className="mono cursor-pointer text-[11px] text-[var(--color-ink-faint)] transition-colors duration-150 hover:text-[var(--color-ink-dim)]"
          >
            ← Overview
          </Link>
        </nav>
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-critical)]">
          Coordinated campaign
        </div>
        <h1 className="mt-2 text-[24px] font-semibold leading-tight sm:text-[30px]">
          {cluster.label}
        </h1>
        <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-[var(--color-ink-dim)]">
          {cluster.notes}
        </p>
      </header>

      <section
        aria-label="Campaign summary"
        className="flex flex-wrap gap-x-12 gap-y-6 rounded border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
      >
        <Stat value={live.length} label="Live right now" tone="critical" />
        <Stat value={members.length} label="Domains total" />
        <Stat value={registrars.size} label="Registrars used" />
        <Stat value={String(cluster.fingerprint.page_builder_version ?? '—')} label="Shared build" />
        <Stat value={cluster.firstSeenAt} label="First registration" />
      </section>

      {/* Timeline — the re-registration story reads clearly here. */}
      <section aria-labelledby="timeline-heading">
        <SectionHeading count={members.length}>
          <span id="timeline-heading">Registration timeline</span>
        </SectionHeading>
        <ol className="relative space-y-0 border-l border-[var(--color-line)] pl-6">
          {members.map((d) => {
            const isReplacement = d.domain === 'joolasg.com';
            return (
              <li key={d.domain} className="relative py-3">
                <span
                  aria-hidden
                  className={`absolute -left-[1.6875rem] top-[1.375rem] size-2 rounded-full ring-4 ring-[var(--color-void)] ${
                    d.isLive ? 'bg-[var(--color-critical)]' : 'bg-[var(--color-ink-faint)]'
                  }`}
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <time className="mono w-24 shrink-0 text-[12px] text-[var(--color-ink-faint)]">
                    {d.infrastructure?.registeredAt ?? '—'}
                  </time>
                  <DomainLink domain={d.domain} className="text-[13px]" />
                  <VerdictBadge verdict={d.verdict} />
                  {isReplacement && (
                    <span className="rounded bg-[var(--color-critical-dim)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-critical)]">
                      registered after Singapore takedown
                    </span>
                  )}
                </div>
                <div className="mono mt-1 text-[11px] text-[var(--color-ink-faint)]">
                  {d.infrastructure?.registrarName ?? 'registrar unknown'}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Registrar grouping — how to actually file the complaints. */}
      <section aria-labelledby="registrar-heading">
        <SectionHeading count={registrars.size}>
          <span id="registrar-heading">Complaint routing by registrar</span>
        </SectionHeading>
        <ul className="space-y-3">
          {[...registrars.entries()].map(([email, domains]) => (
            <li
              key={email}
              className="rounded border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <a
                  href={`mailto:${email}`}
                  className="mono cursor-pointer text-[13px] text-[var(--color-info)] underline decoration-dotted underline-offset-4"
                >
                  {email}
                </a>
                <span className="mono text-[11px] text-[var(--color-ink-faint)]">
                  {domains.length} domain{domains.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                {domains.map((d) => (
                  <li key={d}>
                    <DomainLink domain={d} className="text-[12px]" />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {/* Fingerprint */}
      <section aria-labelledby="fp-heading">
        <SectionHeading>
          <span id="fp-heading">Shared fingerprint — what proves coordination</span>
        </SectionHeading>
        <pre className="mono overflow-x-auto rounded border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-[12px] leading-relaxed text-[var(--color-ink-dim)]">
          {JSON.stringify(cluster.fingerprint, null, 2)}
        </pre>
      </section>
    </div>
  );
}
