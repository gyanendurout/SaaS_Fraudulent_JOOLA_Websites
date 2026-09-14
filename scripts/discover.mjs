/**
 * discover.mjs — scheduled discovery sweep with change detection.
 *
 * Answers "what came newly into the market": runs a discovery sweep, diffs the
 * result against what is already in Supabase, records genuinely new domains,
 * and reports them. Intended to run on a schedule (daily is plenty — the
 * campaign registered ten domains in four days).
 *
 * Also re-checks known domains so a takedown (live -> dead) or a resurrection
 * (dead -> live) is noticed rather than silently missed.
 *
 * Usage:
 *   node scripts/discover.mjs              sweep, diff, persist, report
 *   node scripts/discover.mjs --dry-run    sweep and report, write nothing
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');

/* ---------- env + client ---------- */

async function loadEnv() {
  const raw = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function client({ url, key }) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  return {
    async req(method, pathname, body, extra = {}) {
      const res = await fetch(`${url}/rest/v1/${pathname}`, {
        method,
        headers: { ...headers, ...extra },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status} ${text.slice(0, 300)}`);
      return text ? JSON.parse(text) : null;
    },
  };
}

/* ---------- recon ---------- */

function runRecon(outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/recon.mjs', '--out', outPath], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`recon exited ${code}`))
    );
    child.on('error', reject);
  });
}

/* ---------- main ---------- */

async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('.env.local missing Supabase config');
  const db = client({ url, key });

  // 1. What do we already know?
  const known = await db.req('GET', 'bp_domains?select=id,domain,is_live&limit=2000');
  const knownMap = new Map(known.map((d) => [d.domain, d]));
  console.log(`[discover] ${knownMap.size} domains already tracked\n`);

  // 2. Sweep.
  const stamp = new Date().toISOString().slice(0, 10);
  const reconPath = path.join('evidence', `recon-${stamp}.json`);
  await mkdir('evidence', { recursive: true });
  await runRecon(reconPath);
  const report = JSON.parse(await readFile(reconPath, 'utf8'));

  // 3. Diff.
  const brandNew = [];
  const wentLive = [];
  const wentDark = [];

  for (const d of report.domains) {
    const prev = knownMap.get(d.domain);
    if (!prev) {
      brandNew.push(d);
      continue;
    }
    if (!prev.is_live && d.is_live) wentLive.push(d);
    if (prev.is_live && !d.is_live) wentDark.push(d);
  }

  // 4. Report — this is the output a human reads.
  const line = '─'.repeat(74);
  console.log(`\n${line}`);
  console.log(`DISCOVERY SWEEP  ${report.finished_at}`);
  console.log(line);
  console.log(`  candidates tested   ${report.candidates_tested}`);
  console.log(`  resolving           ${report.candidates_resolved}`);
  console.log(`  NEW domains         ${brandNew.length}`);
  console.log(`  came back online    ${wentLive.length}`);
  console.log(`  went offline        ${wentDark.length}`);

  const section = (title, rows) => {
    if (!rows.length) return;
    console.log(`\n${title}`);
    for (const d of rows) {
      const reg = d.infrastructure?.registered_at ?? '?';
      const ver = d.snapshot?.tech_stack?.page_builder_version;
      const flag = ver === '3.35.6' ? '  <-- MATCHES KNOWN CAMPAIGN FINGERPRINT' : '';
      console.log(`  ${reg}  ${d.domain.padEnd(26)} ${(ver ?? '').padEnd(8)}${flag}`);
    }
  };

  section('NEW SINCE LAST SWEEP', brandNew);
  section('BACK ONLINE', wentLive);
  section('NO LONGER RESOLVING (possible takedown)', wentDark);

  if (!brandNew.length && !wentLive.length && !wentDark.length) {
    console.log('\n  No change since the previous sweep.');
  }

  if (DRY_RUN) {
    console.log('\n[discover] --dry-run: nothing written.');
    return;
  }

  // 5. Persist the run, then the new domains.
  const [run] = await db.req(
    'POST',
    'bp_discovery_runs',
    [
      {
        run_type: 'dns_permutation',
        status: 'done',
        candidates_tested: report.candidates_tested,
        candidates_resolved: report.candidates_resolved,
        domains_new: brandNew.length,
        started_at: report.generated_at,
        finished_at: report.finished_at,
        stats: {
          new_domains: brandNew.map((d) => d.domain),
          went_live: wentLive.map((d) => d.domain),
          went_dark: wentDark.map((d) => d.domain),
        },
      },
    ],
    { Prefer: 'return=representation' }
  );

  for (const d of brandNew) {
    await db.req(
      'POST',
      'bp_domains?on_conflict=domain',
      [
        {
          domain: d.domain,
          match_kind: d.match_kind,
          classification: d.classification,
          discovery_source: 'dns_permutation',
          is_live: d.is_live,
          http_status: d.snapshot?.http_status ?? null,
          last_checked_at: report.finished_at,
        },
      ],
      { Prefer: 'resolution=merge-duplicates,return=representation' }
    );
  }

  // Keep liveness current for everything we re-observed.
  for (const d of report.domains) {
    const prev = knownMap.get(d.domain);
    if (!prev || prev.is_live === d.is_live) continue;
    await db.req(
      'PATCH',
      `bp_domains?domain=eq.${encodeURIComponent(d.domain)}`,
      { is_live: d.is_live, last_checked_at: report.finished_at },
      { Prefer: 'return=minimal' }
    );
  }

  const summaryPath = path.join('evidence', `discovery-${stamp}.json`);
  await writeFile(
    summaryPath,
    JSON.stringify(
      {
        run_id: run?.id,
        finished_at: report.finished_at,
        new_domains: brandNew.map((d) => d.domain),
        went_live: wentLive.map((d) => d.domain),
        went_dark: wentDark.map((d) => d.domain),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`\n[discover] run ${run?.id} recorded; summary -> ${summaryPath}`);
}

main().catch((e) => {
  console.error('[discover] fatal:', e.message ?? e);
  process.exitCode = 1;
});
