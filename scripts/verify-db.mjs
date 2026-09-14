/**
 * verify-db.mjs — post-migration health check.
 *
 * Confirms row counts, that the reporting views resolve, that RLS is enabled on
 * every bp_* table, and — critically — that bp_takedown_actions has NO anon
 * policy, so response strategy is not readable through the public key.
 *
 * Usage: node scripts/verify-db.mjs
 */

import { readFile } from 'node:fs/promises';
import pg from 'pg';

// Postgres DATE (oid 1082) must stay a calendar string. node-postgres otherwise
// parses it into a JS Date at LOCAL midnight, which shifts the day backwards in
// any timezone east of UTC (IST turns 2026-07-20 into 2026-07-19T18:30Z).
// Registration dates end up in legal complaints — a one-day error is not acceptable.
pg.types.setTypeParser(1082, (v) => v);

const raw = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]])
);

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const show = async (label, sql) => {
  const { rows } = await client.query(sql);
  console.log(`\n### ${label}`);
  console.table(rows);
  return rows;
};

await show(
  'row counts',
  `select 'domains' as t, count(*)::int as n from bp_domains
   union all select 'infrastructure', count(*)::int from bp_domain_infrastructure
   union all select 'snapshots', count(*)::int from bp_snapshots
   union all select 'observed_products', count(*)::int from bp_observed_products
   union all select 'cluster_members', count(*)::int from bp_cluster_members
   union all select 'discovery_runs', count(*)::int from bp_discovery_runs`
);

await show(
  'campaign cluster, by registration date',
  `select d.domain, i.registered_at, i.registrar_abuse_email,
          s.tech_stack->>'page_builder_version' as elementor, d.is_live
   from bp_cluster_members m
   join bp_domains d on d.id = m.domain_id
   left join lateral (select * from bp_domain_infrastructure x
                      where x.domain_id = d.id order by observed_at desc limit 1) i on true
   left join lateral (select * from bp_snapshots x
                      where x.domain_id = d.id order by captured_at desc limit 1) s on true
   order by i.registered_at nulls last`
);

await show(
  'view bp_v_active_threats (top 5)',
  `select domain, registered_at, risk_score, verdict from bp_v_active_threats limit 5`
);

await show(
  'RLS enabled per table',
  `select tablename, rowsecurity from pg_tables
   where schemaname='public' and tablename like 'bp\\_%' order by 1`
);

const pol = await show(
  'anon-readable policies per table',
  `select t.tablename, count(p.policyname)::int as policies
   from pg_tables t left join pg_policies p
     on p.schemaname = t.schemaname and p.tablename = t.tablename
   where t.schemaname='public' and t.tablename like 'bp\\_%'
   group by 1 order by 1`
);

const takedown = pol.find((r) => r.tablename === 'bp_takedown_actions');
const ok = takedown && takedown.policies === 0;
console.log(
  `\n${ok ? 'PASS' : 'FAIL'}: bp_takedown_actions has ${takedown?.policies ?? '?'} anon policies (expected 0)`
);

await client.end();
process.exitCode = ok ? 0 : 1;
