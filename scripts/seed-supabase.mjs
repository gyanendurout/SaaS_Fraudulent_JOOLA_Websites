/**
 * seed-supabase.mjs — load a recon evidence file into the bp_* tables.
 *
 * Idempotent: re-running upserts domains and appends new observation rows
 * (infrastructure and snapshots are deliberately append-only history).
 *
 * Prereq: supabase/migrations/20260914000001_brandprotect_schema.sql applied.
 *
 * Usage:
 *   node scripts/seed-supabase.mjs [evidence/recon-2026-09-14.json]
 *   node scripts/seed-supabase.mjs --check     # verify schema, write nothing
 */

import { readFile } from 'node:fs/promises';

/* ---------- env ---------- */
async function loadEnv() {
  const raw = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('.env.local missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  return { url: url.replace(/\/+$/, ''), key };
}

/* ---------- PostgREST ---------- */
function client({ url, key }) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  async function req(method, path, body, extraHeaders = {}) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: { ...headers, ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 400)}`);
    return text ? JSON.parse(text) : null;
  }

  return {
    select: (t, q = '') => req('GET', `${t}?${q}`),
    insert: (t, rows) => req('POST', t, rows, { Prefer: 'return=representation' }),
    upsert: (t, rows, onConflict) =>
      req('POST', `${t}?on_conflict=${onConflict}`, rows, {
        Prefer: 'resolution=merge-duplicates,return=representation',
      }),
  };
}

/* ---------- domain knowledge ---------- */

const CLUSTER = {
  slug: 'joola-impersonation-2026-07',
  label: 'JOOLA impersonation cluster (Jul 2026 wave)',
  first_seen_at: '2026-07-20',
  status: 'active',
  fingerprint: {
    cms: 'wordpress',
    ecommerce: 'woocommerce',
    page_builder: 'elementor',
    page_builder_version: '3.35.6',
    discount_ladder_pct: [57, 50, 50, 50, 30, 57],
    dns_provider: 'cloudflare',
    registrar_jurisdiction: 'CN/HK',
    note:
      'Single USD source catalogue, FX-converted per market. Identical Elementor build across all members.',
  },
  notes:
    'Registered in a 4-day burst 20-23 Jul 2026 across four Chinese/HK registrars, all on Cloudflare DNS. ' +
    'joola-singapore.com taken down late Aug 2026; operator re-registered Singapore as joolasg.com on 27 Aug 2026.',
};

/** Taken down before this recon ran, so it cannot be rediscovered by DNS. */
const HISTORIC = [
  {
    domain: 'joola-singapore.com',
    match_kind: 'prefix',
    classification: 'confirmed_fraud',
    discovery_source: 'partner_report',
    is_live: false,
    taken_down_at: '2026-08-31T00:00:00Z',
    notes:
      'Test purchase by JOOLA local distributor: payment captured, goods never delivered. ' +
      'Confirmed fraudulent. Taken down ~end Aug 2026. Replaced by joolasg.com on 2026-08-27.',
    infrastructure: {
      registrar_name: 'Hongkong Kouming International Limited',
      registrar_abuse_email: 'abuse@kouming.com',
      registered_at: '2026-07-22',
      dns_provider: 'cloudflare',
      is_proxied: true,
    },
  },
];

const CLUSTER_BUILDER_VERSION = '3.35.6';

function isClusterMember(d) {
  return d.snapshot?.tech_stack?.page_builder_version === CLUSTER_BUILDER_VERSION;
}

/* ---------- main ---------- */

async function main() {
  const env = await loadEnv();
  const db = client(env);
  const checkOnly = process.argv.includes('--check');

  // Fail fast with a useful message if the migration has not been applied.
  try {
    await db.select('bp_domains', 'limit=1');
  } catch (e) {
    console.error(
      '\n[seed] bp_* tables not found.\n' +
        '[seed] Apply supabase/migrations/20260914000001_brandprotect_schema.sql first\n' +
        '[seed] (Supabase dashboard -> SQL Editor -> paste -> Run), then re-run this.\n'
    );
    console.error(`[seed] underlying error: ${String(e).slice(0, 200)}`);
    // exitCode (not process.exit) so pending fetch timers drain cleanly on Windows
    process.exitCode = 1;
    return;
  }
  console.log('[seed] schema present.');
  if (checkOnly) return;

  const file = process.argv.find((a) => a.endsWith('.json')) ?? 'evidence/recon-2026-09-14.json';
  const report = JSON.parse(await readFile(file, 'utf8'));
  console.log(`[seed] loaded ${file}: ${report.domains.length} domains`);

  /* cluster */
  const [cluster] = await db.upsert('bp_clusters', [CLUSTER], 'slug');
  console.log(`[seed] cluster ${cluster.slug}`);

  /* discovery run */
  const [run] = await db.insert('bp_discovery_runs', [
    {
      run_type: 'dns_permutation',
      status: 'done',
      candidates_tested: report.candidates_tested,
      candidates_resolved: report.candidates_resolved,
      started_at: report.generated_at,
      finished_at: report.finished_at,
      stats: { source_file: file, brand: report.brand },
    },
  ]);

  const all = [...report.domains, ...HISTORIC];
  let members = 0;

  for (const d of all) {
    const [row] = await db.upsert(
      'bp_domains',
      [
        {
          domain: d.domain,
          match_kind: d.match_kind ?? 'prefix',
          classification: d.classification,
          discovery_source: d.discovery_source,
          is_live: d.is_live,
          http_status: d.snapshot?.http_status ?? null,
          last_checked_at: report.finished_at,
          taken_down_at: d.taken_down_at ?? null,
          notes: d.notes ?? null,
        },
      ],
      'domain'
    );

    if (d.infrastructure) {
      await db.insert('bp_domain_infrastructure', [
        {
          domain_id: row.id,
          ...d.infrastructure,
          resolved_ips: d.resolved_ips ?? null,
          is_proxied:
            d.infrastructure.is_proxied ?? d.infrastructure.dns_provider === 'cloudflare',
          observed_at: report.finished_at,
        },
      ]);
    }

    if (d.snapshot) {
      const member = isClusterMember(d);
      const [snap] = await db.insert('bp_snapshots', [
        {
          domain_id: row.id,
          captured_at: report.finished_at,
          http_status: d.snapshot.http_status,
          final_url: d.snapshot.final_url,
          response_headers: d.snapshot.response_headers,
          html_sha256: d.snapshot.html_sha256,
          html_bytes: d.snapshot.html_bytes,
          tech_stack: d.snapshot.tech_stack,
          signals: {
            brand_mentions: d.snapshot.brand_mentions,
            currency: d.snapshot.currency,
            discount_ladder: (d.snapshot.price_ladder ?? []).map((p) => p.discount_pct),
            cluster_fingerprint_match: member,
          },
          risk_score: member ? 92 : null,
          verdict: member ? 'high_risk' : null,
        },
      ]);

      const ladder = d.snapshot.price_ladder ?? [];
      if (ladder.length) {
        await db.insert(
          'bp_observed_products',
          ladder.map((p) => ({
            snapshot_id: snap.id,
            domain_id: row.id,
            currency: d.snapshot.currency,
            regular_price: p.regular_price,
            sale_price: p.sale_price,
            discount_pct: p.discount_pct,
            captured_at: report.finished_at,
          }))
        );
      }
    }

    if (isClusterMember(d) || d.classification === 'confirmed_fraud') {
      await db.upsert(
        'bp_cluster_members',
        [
          {
            cluster_id: cluster.id,
            domain_id: row.id,
            confidence: 'high',
            rationale:
              d.classification === 'confirmed_fraud'
                ? 'Confirmed fraudulent by distributor test purchase; shares cluster infrastructure.'
                : `Identical Elementor ${CLUSTER_BUILDER_VERSION} build, shared discount ladder, Cloudflare DNS, CN/HK registrar, same registration burst.`,
          },
        ],
        'cluster_id,domain_id'
      );
      members++;
    }
  }

  console.log(`[seed] ${all.length} domains written, ${members} linked to cluster.`);
  console.log(`[seed] discovery run ${run.id}`);
}

main().catch((e) => {
  console.error('[seed] fatal:', e.message ?? e);
  process.exitCode = 1;
});
