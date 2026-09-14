/**
 * Data access with two interchangeable backends.
 *
 *   fixture  — reads the recon evidence JSON from disk. Always available.
 *   supabase — reads the bp_* tables. Used when the schema exists.
 *
 * Selection is automatic: try Supabase, fall back to fixture. This means the UI
 * is developed and tested against real evidence today, and switches to the live
 * database the moment the migration is applied, with no code change.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { matchBrandDomain, matchPriority } from '@/lib/domain-match';
import { evaluateSignals, riskScore, verdictFor, dedupeLadder } from '@/lib/fingerprint';
import type { Cluster, Dataset, DomainRecord, DiscoveryRun, Infrastructure, Snapshot } from '@/lib/types';

const CLUSTER_BUILDER_VERSION = '3.35.6';
const KNOWN_LEGITIMATE = new Set(['joola.com', 'joolausa.com', 'joola.de']);
const CONFIRMED_FRAUD = new Set(['joola-singapore.com']);

/* ------------------------------------------------------------------ *
 * Domain taken down before recon ran, so DNS can no longer find it.
 * ------------------------------------------------------------------ */
const HISTORIC_DOMAINS = [
  {
    domain: 'joola-singapore.com',
    match_kind: 'prefix',
    classification: 'confirmed_fraud',
    discovery_source: 'partner_report',
    is_live: false,
    taken_down_at: '2026-08-31T00:00:00Z',
    notes:
      'Test purchase by a JOOLA authorised distributor: payment captured, goods never delivered. ' +
      'Taken down ~end Aug 2026. Operator re-registered Singapore as joolasg.com on 2026-08-27.',
    infrastructure: {
      registrar_name: 'Hongkong Kouming International Limited',
      registrar_abuse_email: 'abuse@kouming.com',
      registered_at: '2026-07-22',
      dns_provider: 'cloudflare',
      nameservers: [],
      domain_status: [],
    },
    snapshot: null,
    resolved_ips: [],
  },
] as const;

/* ------------------------------------------------------------------ *
 * Normalisation — one shape regardless of backend
 * ------------------------------------------------------------------ */

interface RawDomain {
  domain: string;
  match_kind?: string | null;
  classification?: string;
  discovery_source?: string;
  is_live?: boolean;
  /** When WE first recorded this domain — not when it was registered. */
  first_seen_at?: string | null;
  last_checked_at?: string | null;
  taken_down_at?: string | null;
  notes?: string | null;
  resolved_ips?: string[];
  infrastructure?: Record<string, unknown> | null;
  snapshot?: Record<string, unknown> | null;
}

function toInfrastructure(raw: Record<string, unknown> | null | undefined, ips: string[]): Infrastructure | null {
  if (!raw) return null;
  const dns = (raw.dns_provider as string | null) ?? null;
  return {
    registrarName: (raw.registrar_name as string) ?? null,
    registrarIanaId: (raw.registrar_iana_id as number) ?? null,
    registrarAbuseEmail: (raw.registrar_abuse_email as string) ?? null,
    registrarAbusePhone: (raw.registrar_abuse_phone as string) ?? null,
    registeredAt: (raw.registered_at as string) ?? null,
    expiresAt: (raw.expires_at as string) ?? null,
    domainStatus: (raw.domain_status as string[]) ?? [],
    nameservers: (raw.nameservers as string[]) ?? [],
    dnsProvider: dns,
    resolvedIps: ips,
    isProxied: (dns ?? '').toLowerCase() === 'cloudflare',
  };
}

function toSnapshot(raw: Record<string, unknown> | null | undefined, capturedAt: string): Snapshot | null {
  if (!raw) return null;
  const ts = (raw.tech_stack as Record<string, unknown>) ?? {};
  return {
    capturedAt,
    httpStatus: (raw.http_status as number) ?? null,
    finalUrl: (raw.final_url as string) ?? null,
    responseHeaders: (raw.response_headers as Record<string, string>) ?? {},
    htmlSha256: (raw.html_sha256 as string) ?? null,
    htmlBytes: (raw.html_bytes as number) ?? null,
    techStack: {
      cms: (ts.cms as string) ?? null,
      ecommerce: (ts.ecommerce as string) ?? null,
      pageBuilder: (ts.page_builder as string) ?? null,
      pageBuilderVersion: (ts.page_builder_version as string) ?? null,
    },
    currency: (raw.currency as string) ?? null,
    priceLadder: dedupeLadder(
      ((raw.price_ladder as Array<Record<string, number>>) ?? []).map((p) => ({
        regularPrice: p.regular_price ?? 0,
        salePrice: p.sale_price ?? 0,
        discountPct: p.discount_pct ?? 0,
      }))
    ),
    brandMentions: (raw.brand_mentions as number) ?? 0,
  };
}

function enrich(raw: RawDomain, capturedAt: string): DomainRecord {
  const infrastructure = toInfrastructure(raw.infrastructure, raw.resolved_ips ?? []);
  const snapshot = toSnapshot(raw.snapshot, capturedAt);

  const isKnownLegitimate = KNOWN_LEGITIMATE.has(raw.domain);
  const isConfirmedFraud = CONFIRMED_FRAUD.has(raw.domain);
  const inCluster = snapshot?.techStack.pageBuilderVersion === CLUSTER_BUILDER_VERSION;

  const signals = evaluateSignals({
    registeredAt: infrastructure?.registeredAt,
    isLive: raw.is_live,
    techStack: snapshot?.techStack,
    priceLadder: snapshot?.priceLadder,
    brandMentions: snapshot?.brandMentions,
    dnsProvider: infrastructure?.dnsProvider,
    matchedClusterFingerprint: inCluster,
    asOf: new Date(capturedAt),
  });

  const score = riskScore(signals, isKnownLegitimate);
  const match = matchBrandDomain(raw.domain);

  return {
    domain: raw.domain,
    matchKind: match?.matchKind ?? null,
    matchedIn: match?.matchedIn ?? null,
    classification: isKnownLegitimate
      ? 'legitimate'
      : isConfirmedFraud
        ? 'confirmed_fraud'
        : (raw.classification as DomainRecord['classification']) ?? 'suspect',
    discoverySource: (raw.discovery_source as DomainRecord['discoverySource']) ?? 'dns_permutation',
    isLive: raw.is_live ?? false,
    // first_seen_at is the date the domain entered OUR database, which is what
    // the weekly change report is measured against. Falling back to the capture
    // time would silently re-date every domain to "today" on every read.
    firstSeenAt: raw.first_seen_at ?? capturedAt,
    lastCheckedAt: raw.last_checked_at ?? capturedAt,
    takenDownAt: raw.taken_down_at ?? null,
    notes: raw.notes ?? null,
    infrastructure,
    snapshot,
    signals,
    riskScore: score,
    verdict: verdictFor(score, {
      isKnownLegitimate,
      isConfirmedFraud,
      isLive: raw.is_live ?? null,
    }),
    clusterSlug: inCluster || isConfirmedFraud ? 'joola-impersonation-2026-07' : null,
    priority: match ? matchPriority(match) : 0,
  };
}

function buildClusters(domains: DomainRecord[]): Cluster[] {
  const members = domains.filter((d) => d.clusterSlug === 'joola-impersonation-2026-07');
  if (!members.length) return [];

  const registrars = [
    ...new Set(members.map((m) => m.infrastructure?.registrarAbuseEmail).filter(Boolean)),
  ] as string[];

  return [
    {
      slug: 'joola-impersonation-2026-07',
      label: 'JOOLA impersonation cluster (Jul 2026 wave)',
      firstSeenAt:
        members
          .map((m) => m.infrastructure?.registeredAt)
          .filter(Boolean)
          .sort()[0] ?? '2026-07-20',
      status: 'active',
      fingerprint: {
        cms: 'wordpress',
        ecommerce: 'woocommerce',
        page_builder: 'elementor',
        page_builder_version: CLUSTER_BUILDER_VERSION,
        discount_ladder_pct: [57, 50, 30],
        dns_provider: 'cloudflare',
        registrar_abuse_contacts: registrars,
      },
      notes:
        'Registered in a four-day burst 20-23 Jul 2026 across four Chinese/HK registrars, all on ' +
        'Cloudflare DNS. Single USD source catalogue, FX-converted per market. joola-singapore.com ' +
        'was taken down late Aug 2026; the operator re-registered Singapore as joolasg.com on 27 Aug 2026.',
      memberDomains: members.map((m) => m.domain),
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Fixture backend
 * ------------------------------------------------------------------ */

async function loadFixture(): Promise<Dataset> {
  const file = path.join(process.cwd(), 'evidence', 'recon-2026-09-14.json');
  const report = JSON.parse(await readFile(file, 'utf8'));
  const capturedAt: string = report.finished_at ?? report.generated_at;

  const raw: RawDomain[] = [...report.domains, ...HISTORIC_DOMAINS];
  const domains = raw.map((d) => enrich(d, capturedAt)).sort(sortByThreat);

  return {
    generatedAt: capturedAt,
    source: 'fixture',
    domains,
    clusters: buildClusters(domains),
    runs: [
      {
        runType: 'dns_permutation',
        status: 'done',
        candidatesTested: report.candidates_tested,
        candidatesResolved: report.candidates_resolved,
        startedAt: report.generated_at,
        finishedAt: report.finished_at,
      },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Supabase backend
 * ------------------------------------------------------------------ */

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadSupabase(): Promise<Dataset | null> {
  const sb = supabaseAdmin();
  if (!sb) return null;

  // Fetched as three flat reads and joined in memory. PostgREST can embed
  // related rows, but not "latest row per parent" — and infrastructure and
  // snapshots are deliberately append-only history, so we must pick the most
  // recent observation per domain ourselves.
  const [domainsRes, infraRes, snapsRes, productsRes, runsRes] = await Promise.all([
    sb
      .from('bp_domains')
      .select(
        'id, domain, match_kind, classification, discovery_source, is_live, http_status, first_seen_at, taken_down_at, notes, last_checked_at'
      )
      .limit(1000),
    sb.from('bp_domain_infrastructure').select('*').limit(2000),
    sb.from('bp_snapshots').select('*').limit(2000),
    sb.from('bp_observed_products').select('*').limit(5000),
    sb.from('bp_discovery_runs').select('*').order('started_at', { ascending: false }).limit(10),
  ]);

  // Table missing (migration not applied) or any other error -> caller falls back.
  if (domainsRes.error || !domainsRes.data) return null;

  const latestBy = <T extends Record<string, unknown>>(
    rows: T[] | null,
    key: string,
    tsField: string
  ): Map<string, T> => {
    const out = new Map<string, T>();
    for (const row of rows ?? []) {
      const id = row[key] as string;
      const prev = out.get(id);
      if (!prev || String(row[tsField] ?? '') > String(prev[tsField] ?? '')) out.set(id, row);
    }
    return out;
  };

  const infraByDomain = latestBy(infraRes.data, 'domain_id', 'observed_at');
  const snapByDomain = latestBy(snapsRes.data, 'domain_id', 'captured_at');

  const productsByDomain = new Map<string, Array<Record<string, number>>>();
  for (const p of productsRes.data ?? []) {
    const list = productsByDomain.get(p.domain_id as string) ?? [];
    list.push(p as Record<string, number>);
    productsByDomain.set(p.domain_id as string, list);
  }

  const capturedAt = new Date().toISOString();

  const domains = domainsRes.data
    .map((row) => {
      const infra = infraByDomain.get(row.id as string) ?? null;
      const snap = snapByDomain.get(row.id as string) ?? null;
      const products = productsByDomain.get(row.id as string) ?? [];

      // Price ladder lives in its own table; fold it back into the snapshot shape.
      const snapshot = snap
        ? {
            ...snap,
            currency: products[0]?.currency ?? (snap.signals as Record<string, unknown>)?.currency,
            price_ladder: products.map((p) => ({
              regular_price: Number(p.regular_price),
              sale_price: Number(p.sale_price),
              discount_pct: Number(p.discount_pct),
            })),
            brand_mentions:
              ((snap.signals as Record<string, unknown>)?.brand_mentions as number) ?? 0,
          }
        : null;

      const raw: RawDomain = {
        domain: row.domain as string,
        match_kind: row.match_kind as string | null,
        classification: row.classification as string,
        discovery_source: row.discovery_source as string,
        is_live: row.is_live as boolean,
        first_seen_at: row.first_seen_at as string | null,
        last_checked_at: row.last_checked_at as string | null,
        taken_down_at: row.taken_down_at as string | null,
        notes: row.notes as string | null,
        resolved_ips: (infra?.resolved_ips as string[]) ?? [],
        infrastructure: infra,
        snapshot,
      };

      return enrich(raw, (snap?.captured_at as string) ?? (row.last_checked_at as string) ?? capturedAt);
    })
    .sort(sortByThreat);

  return {
    generatedAt: capturedAt,
    source: 'supabase',
    domains,
    clusters: buildClusters(domains),
    runs: (runsRes.data ?? []).map((r) => ({
      runType: r.run_type as string,
      status: r.status as string,
      candidatesTested: (r.candidates_tested as number) ?? 0,
      candidatesResolved: (r.candidates_resolved as number) ?? 0,
      startedAt: r.started_at as string,
      finishedAt: r.finished_at as string | null,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

function sortByThreat(a: DomainRecord, b: DomainRecord): number {
  if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
  if (a.riskScore !== b.riskScore) return b.riskScore - a.riskScore;
  const ar = a.infrastructure?.registeredAt ?? '';
  const br = b.infrastructure?.registeredAt ?? '';
  return br.localeCompare(ar);
}

let cache: { at: number; data: Dataset } | null = null;
/** Underlying data changes on the weekly scan, so a short TTL costs nothing. */
const CACHE_MS = 30_000;

/**
 * The load currently in flight, if any.
 *
 * Without this, every request arriving on a cold or expired cache starts its own
 * load — and each load is five Supabase round-trips. A burst of concurrent
 * requests therefore multiplied into dozens of simultaneous queries, and page
 * renders slowed until they timed out. Holding the promise means concurrent
 * callers await the same load and the database sees one.
 */
let inFlight: Promise<Dataset> | null = null;

export async function getDataset(): Promise<Dataset> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const data = (await loadSupabase()) ?? (await loadFixture());
      cache = { at: Date.now(), data };
      return data;
    } finally {
      // Cleared even on failure, so a transient error does not wedge every
      // later request onto the same rejected promise.
      inFlight = null;
    }
  })();

  return inFlight;
}

export async function getDomain(domain: string): Promise<DomainRecord | null> {
  const ds = await getDataset();
  return ds.domains.find((d) => d.domain === domain.toLowerCase()) ?? null;
}

export async function getThreats(): Promise<DomainRecord[]> {
  const ds = await getDataset();
  return ds.domains.filter((d) => d.classification !== 'legitimate' && d.riskScore >= 40);
}
