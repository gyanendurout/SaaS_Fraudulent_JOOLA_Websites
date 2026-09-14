import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDataset, getDomain } from '@/data/repository';
import { generateTakedownPack } from '@/lib/takedown';
import { VerdictBadge, RiskMeter, SectionHeading, Field, DomainLink } from '@/components/primitives';
import { TakedownPack } from '@/components/takedown-pack';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  return { title: `${decodeURIComponent(domain)} — JOOLA Brand Protection` };
}

const SEVERITY_TONE = {
  critical: 'text-[var(--color-critical)]',
  high: 'text-[var(--color-critical)]',
  medium: 'text-[var(--color-warn)]',
  low: 'text-[var(--color-ink-dim)]',
  info: 'text-[var(--color-ink-faint)]',
} as const;

export default async function DomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: rawDomain } = await params;
  const domain = decodeURIComponent(rawDomain).toLowerCase();

  const record = await getDomain(domain);
  if (!record) notFound();

  const ds = await getDataset();
  const cluster = ds.clusters.find((c) => c.slug === record.clusterSlug) ?? null;
  const siblings = cluster
    ? ds.domains.filter((d) => d.clusterSlug === cluster.slug && d.domain !== record.domain)
    : [];

  const takedowns =
    record.classification === 'legitimate' ? [] : generateTakedownPack(record, cluster);

  const i = record.infrastructure;
  const s = record.snapshot;

  return (
    <div className="space-y-10">
      {/* Header -------------------------------------------------------- */}
      <header>
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href="/"
            className="mono cursor-pointer text-[11px] text-[var(--color-ink-faint)] transition-colors duration-150 hover:text-[var(--color-ink-dim)]"
          >
            ← Overview
          </Link>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h1 className="mono break-all text-[24px] font-bold leading-tight sm:text-[30px]">
              {record.domain}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <VerdictBadge verdict={record.verdict} size="lg" />
              <span
                className={`mono inline-flex items-center gap-1.5 text-[12px] ${
                  record.isLive ? 'text-[var(--color-critical)]' : 'text-[var(--color-ink-faint)]'
                }`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${
                    record.isLive ? 'bg-[var(--color-critical)]' : 'bg-[var(--color-ink-faint)]'
                  }`}
                />
                {record.isLive ? 'Serving traffic' : 'Offline'}
              </span>
              {record.snapshot?.httpStatus && (
                <span className="mono text-[12px] text-[var(--color-ink-faint)]">
                  HTTP {record.snapshot.httpStatus}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
              Risk score
            </div>
            <div className="mt-1.5">
              <RiskMeter score={record.riskScore} />
            </div>
          </div>
        </div>

        {record.notes && (
          <p className="mt-5 max-w-3xl rounded border-l-2 border-[var(--color-critical)] bg-[var(--color-critical-dim)]/30 py-3 pl-4 pr-4 text-[13px] leading-relaxed text-[var(--color-ink-dim)]">
            {record.notes}
          </p>
        )}
      </header>

      {/* Registry + infrastructure ------------------------------------- */}
      <section aria-labelledby="registry-heading">
        <SectionHeading>
          <span id="registry-heading">Registry &amp; infrastructure</span>
        </SectionHeading>
        <dl className="grid gap-5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Registered">{i?.registeredAt}</Field>
          <Field label="Expires">{i?.expiresAt}</Field>
          <Field label="Registrar" mono={false}>
            {i?.registrarName}
          </Field>
          <Field label="Registrar abuse contact">
            {i?.registrarAbuseEmail ? (
              <a
                href={`mailto:${i.registrarAbuseEmail}`}
                className="cursor-pointer text-[var(--color-info)] underline decoration-dotted underline-offset-4"
              >
                {i.registrarAbuseEmail}
              </a>
            ) : null}
          </Field>
          <Field label="Abuse phone">{i?.registrarAbusePhone}</Field>
          <Field label="DNS provider">
            {i?.dnsProvider}
            {i?.isProxied && (
              <span className="ml-2 text-[11px] text-[var(--color-warn)]">origin concealed</span>
            )}
          </Field>
          <Field label="Nameservers">
            {i?.nameservers.length ? (
              <span className="block space-y-0.5">
                {i.nameservers.map((n) => (
                  <span key={n} className="block">
                    {n}
                  </span>
                ))}
              </span>
            ) : null}
          </Field>
          <Field label="Resolved IPs">
            {i?.resolvedIps.length ? (
              <span className="block space-y-0.5">
                {i.resolvedIps.map((ip) => (
                  <span key={ip} className="block">
                    {ip}
                  </span>
                ))}
              </span>
            ) : null}
          </Field>
          <Field label="Registry status">{i?.domainStatus.join(', ')}</Field>
        </dl>
      </section>

      {/* Platform ------------------------------------------------------ */}
      {s && (
        <section aria-labelledby="platform-heading">
          <SectionHeading>
            <span id="platform-heading">Platform fingerprint</span>
          </SectionHeading>
          <dl className="grid gap-5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="CMS">{s.techStack.cms}</Field>
            <Field label="E-commerce">{s.techStack.ecommerce}</Field>
            <Field label="Page builder">
              {s.techStack.pageBuilder}
              {s.techStack.pageBuilderVersion && (
                <span
                  className={
                    s.techStack.pageBuilderVersion === '3.35.6'
                      ? ' text-[var(--color-critical)]'
                      : ''
                  }
                >
                  {' '}
                  {s.techStack.pageBuilderVersion}
                </span>
              )}
            </Field>
            <Field label="Brand mentions">
              {s.brandMentions ? s.brandMentions.toLocaleString() : null}
            </Field>
            <Field label="Currency">{s.currency}</Field>
            <Field label="Page size">
              {s.htmlBytes ? `${(s.htmlBytes / 1024).toFixed(0)} KB` : null}
            </Field>
            <Field label="Server">{s.responseHeaders?.server}</Field>
            <Field label="Evidence hash">
              {s.htmlSha256 ? (
                <span className="break-all text-[11px]">sha256:{s.htmlSha256.slice(0, 24)}…</span>
              ) : null}
            </Field>
          </dl>
        </section>
      )}

      {/* Pricing ------------------------------------------------------- */}
      {s && s.priceLadder.length > 0 && (
        <section aria-labelledby="pricing-heading">
          <SectionHeading count={s.priceLadder.length}>
            <span id="pricing-heading">Observed pricing</span>
          </SectionHeading>
          <div className="overflow-x-auto rounded border border-[var(--color-line)]">
            <table className="w-full min-w-[420px] border-collapse text-left">
              <caption className="sr-only">
                Struck-through and sale prices observed on {record.domain}
              </caption>
              <thead>
                <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
                  {['Listed price', 'Sale price', 'Discount'].map((h) => (
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
                {s.priceLadder.slice(0, 8).map((p, idx) => (
                  <tr key={idx} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="mono px-4 py-2.5 text-[13px] text-[var(--color-ink-faint)] line-through">
                      {s.currency} {p.regularPrice.toFixed(2)}
                    </td>
                    <td className="mono px-4 py-2.5 text-[13px] text-[var(--color-ink)]">
                      {s.currency} {p.salePrice.toFixed(2)}
                    </td>
                    <td className="mono px-4 py-2.5 text-[13px] font-medium text-[var(--color-critical)]">
                      −{p.discountPct.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Signals ------------------------------------------------------- */}
      <section aria-labelledby="signals-heading">
        <SectionHeading count={record.signals.filter((x) => x.triggered).length}>
          <span id="signals-heading">Triggered signals</span>
        </SectionHeading>
        <ul className="divide-y divide-[var(--color-line)] rounded border border-[var(--color-line)] bg-[var(--color-surface)]">
          {record.signals.map((sig) => (
            <li key={sig.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
              <span
                aria-hidden
                className={`mono w-4 shrink-0 text-[13px] ${
                  sig.triggered ? SEVERITY_TONE[sig.severity] : 'text-[var(--color-ink-faint)]'
                }`}
              >
                {sig.triggered ? '●' : '○'}
              </span>
              <span
                className={`flex-1 text-[13px] ${
                  sig.triggered ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-faint)]'
                }`}
              >
                {sig.label}
              </span>
              {sig.detail && (
                <span className="mono text-[11px] text-[var(--color-ink-dim)]">{sig.detail}</span>
              )}
              <span className="mono w-20 text-right text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                {sig.triggered ? sig.severity : 'clear'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
          Signals are deterministic and reproducible from stored evidence.
        </p>
      </section>

      {/* Cluster ------------------------------------------------------- */}
      {cluster && (
        <section aria-labelledby="cluster-heading">
          <SectionHeading
            count={siblings.length}
            action={
              <Link
                href={`/cluster/${cluster.slug}`}
                className="cursor-pointer text-[12px] text-[var(--color-info)] underline decoration-dotted underline-offset-4"
              >
                Open campaign →
              </Link>
            }
          >
            <span id="cluster-heading">Related domains in the same campaign</span>
          </SectionHeading>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((d) => (
              <li key={d.domain}>
                <Link
                  href={`/domain/${d.domain}`}
                  className="mono inline-flex cursor-pointer items-center gap-2 rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] transition-colors duration-150 hover:border-[var(--color-line-bright)]"
                >
                  <span
                    aria-hidden
                    className={`size-1.5 rounded-full ${
                      d.isLive ? 'bg-[var(--color-critical)]' : 'bg-[var(--color-ink-faint)]'
                    }`}
                  />
                  {d.domain}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Takedown ------------------------------------------------------ */}
      {takedowns.length > 0 && (
        <section aria-labelledby="takedown-heading">
          <SectionHeading count={takedowns.length}>
            <span id="takedown-heading">Takedown pack</span>
          </SectionHeading>
          <TakedownPack drafts={takedowns} />
        </section>
      )}

      {record.classification === 'legitimate' && (
        <p className="rounded border border-[var(--color-safe)]/30 bg-[var(--color-safe-dim)] px-4 py-3 text-[13px] text-[var(--color-ink-dim)]">
          Verified JOOLA property. Excluded from reporting and never included in takedown requests.
        </p>
      )}
    </div>
  );
}
