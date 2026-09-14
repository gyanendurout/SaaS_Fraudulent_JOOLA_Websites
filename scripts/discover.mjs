/**
 * discover.mjs — scheduled discovery sweep with change detection.
 *
 * Answers "what came newly into the market": runs a discovery sweep, diffs the
 * result against what is already in Supabase, records genuinely new domains,
 * and reports them. Runs weekly (Monday 08:00 IST) via
 * .github/workflows/weekly-scan.yml — the campaign registered ten domains in
 * four days, so a week is the longest gap that is still defensible.
 *
 * Also re-checks known domains so a takedown (live -> dead) or a resurrection
 * (dead -> live) is noticed rather than silently missed, and stamps
 * bp_domains.taken_down_at so "when did this go down" is answerable later.
 *
 * Every domain carries first_seen_at — the date WE added it, which is distinct
 * from registered_at (the date the operator bought it). Both appear in the
 * report because they answer different questions.
 *
 * Usage:
 *   node scripts/discover.mjs              sweep, diff, persist, report
 *   node scripts/discover.mjs --dry-run    sweep and report, write nothing
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');

/** Date-only view of a timestamp, without the local-timezone shift that
 *  `new Date(...).toLocaleDateString()` would introduce. */
const day = (ts) => (ts ? String(ts).slice(0, 10) : '—');

/* ---------- env + client ---------- */

/**
 * Read config from .env.local when present (local runs), otherwise from the
 * process environment (CI, where secrets arrive as env vars and no file exists).
 */
async function loadEnv() {
  const env = {};
  try {
    const raw = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  } catch {
    /* no .env.local — expected in CI */
  }
  for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY']) {
    if (!env[k] && process.env[k]) env[k] = process.env[k];
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

/* ---------- weekly report ---------- */

/**
 * The artefact a human reads on Monday morning. Deliberately leads with change,
 * not with the full watchlist — the full list is in the app.
 */
function renderMarkdown({ report, brandNew, wentLive, wentDark, notReSwept, trackedTotal }) {
  const stamp = day(report.finished_at);
  const L = [];
  const changed = brandNew.length + wentLive.length + wentDark.length;

  L.push(`# Weekly scan — ${stamp}`);
  L.push('');
  L.push(
    `**Swept:** ${report.candidates_tested} candidate domains · ` +
      `**resolving:** ${report.candidates_resolved} · ` +
      `**tracked in database:** ${trackedTotal}`
  );
  L.push('');
  L.push(
    changed === 0
      ? '**No change since the previous scan.** No new domains, none taken down, none resurrected.'
      : `**${changed} change${changed === 1 ? '' : 's'} this week.**`
  );
  L.push('');
  L.push('| | Count |');
  L.push('|---|---|');
  L.push(`| New domains found | ${brandNew.length} |`);
  L.push(`| Went offline (possible takedown) | ${wentDark.length} |`);
  L.push(`| Came back online | ${wentLive.length} |`);
  L.push('');

  const table = (title, rows, note) => {
    if (!rows.length) return;
    L.push(`## ${title}`);
    L.push('');
    if (note) {
      L.push(note);
      L.push('');
    }
    L.push('| Domain | Added to our DB | Registered | Platform | Builder | Abuse contact |');
    L.push('|---|---|---|---|---|---|');
    for (const d of rows) {
      const i = d.infrastructure ?? {};
      const ts = d.snapshot?.tech_stack ?? {};
      const ver = ts.page_builder_version ?? '—';
      L.push(
        `| \`${d.domain}\` | ${day(d.first_seen_at)} | ${i.registered_at ?? '—'} | ` +
          `${ts.ecommerce ?? ts.cms ?? '—'} | ${ver === '3.35.6' ? `**${ver}**` : ver} | ` +
          `${i.registrar_abuse_email ?? '—'} |`
      );
    }
    L.push('');
  };

  table(
    'New this week',
    brandNew,
    'Domains that were not in the database before this scan. A builder version of ' +
      '**3.35.6** matches the known July 2026 campaign fingerprint.'
  );
  table(
    'Went offline',
    wentDark,
    'These resolved at the previous scan and do not now. That is consistent with a ' +
      'takedown, but it is not proof of one — a registrar suspension, an expiry and a ' +
      'deliberate pause look identical from outside.'
  );
  // Only claim a failed takedown where we actually recorded one. A domain that
  // simply never served before and now does is a different event, and calling it
  // a resurrected takedown would overstate the evidence.
  const resurrected = wentLive.filter((d) => d.taken_down_at);
  table(
    'Came back online',
    wentLive,
    resurrected.length
      ? `Previously dark, now serving again. ${resurrected.length} of these had been ` +
          `recorded as taken down (${resurrected.map((d) => `\`${d.domain}\``).join(', ')}), ` +
          'so that takedown did not hold.'
      : 'Recorded as not serving at the previous scan and resolving now. None had been ' +
          'stamped as taken down, so this is a domain becoming active rather than a ' +
          'takedown being reversed.'
  );

  if (notReSwept.length) {
    L.push('## Tracked but not reached by this scan');
    L.push('');
    L.push(
      'Recorded as live but not produced by the current candidate list, so their status ' +
        'is unverified this week rather than confirmed.'
    );
    L.push('');
    for (const k of notReSwept) L.push(`- \`${k.domain}\` (added ${day(k.first_seen_at)})`);
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push(
    `Generated by \`scripts/discover.mjs\` at ${report.finished_at}. ` +
      '"Added to our DB" is when this system first recorded the domain; "Registered" is ' +
      'when the operator bought it. Discovery is a DNS permutation sweep, so it finds ' +
      'domains matching known naming patterns — absence from this report is not proof ' +
      'that nothing new exists.'
  );
  L.push('');
  return L.join('\n');
}

/* ---------- main ---------- */

async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('.env.local missing Supabase config');
  const db = client({ url, key });

  // 1. What do we already know?
  const known = await db.req(
    'GET',
    'bp_domains?select=id,domain,is_live,first_seen_at,taken_down_at&limit=2000'
  );
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
      brandNew.push({ ...d, first_seen_at: report.finished_at });
      continue;
    }
    const withDates = { ...d, first_seen_at: prev.first_seen_at, taken_down_at: prev.taken_down_at };
    if (!prev.is_live && d.is_live) wentLive.push(withDates);
    if (prev.is_live && !d.is_live) wentDark.push(withDates);
  }

  // Domains we track that the sweep never reached at all (the candidate list no
  // longer generates them, or DNS failed). Without this they would silently
  // stay "live" in the database forever.
  const sweptDomains = new Set(report.domains.map((d) => d.domain));
  const notReSwept = known.filter((k) => k.is_live && !sweptDomains.has(k.domain));

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
    console.log(`  ${'added to db'.padEnd(12)} ${'registered'.padEnd(12)} domain`);
    for (const d of rows) {
      const reg = d.infrastructure?.registered_at ?? '?';
      const added = day(d.first_seen_at);
      const ver = d.snapshot?.tech_stack?.page_builder_version;
      const flag = ver === '3.35.6' ? '  <-- MATCHES KNOWN CAMPAIGN FINGERPRINT' : '';
      console.log(
        `  ${added.padEnd(12)} ${String(reg).padEnd(12)} ${d.domain.padEnd(26)} ${(ver ?? '').padEnd(8)}${flag}`
      );
    }
  };

  section('NEW SINCE LAST SWEEP', brandNew);
  section('BACK ONLINE', wentLive);
  section('NO LONGER RESOLVING (possible takedown)', wentDark);

  if (notReSwept.length) {
    console.log('\nTRACKED BUT NOT REACHED BY THIS SWEEP');
    for (const k of notReSwept) console.log(`  ${day(k.first_seen_at).padEnd(12)} ${k.domain}`);
  }

  if (!brandNew.length && !wentLive.length && !wentDark.length) {
    console.log('\n  No change since the previous sweep.');
  }

  // The Markdown report is written in both modes — it reads the sweep, not the
  // database, so a dry run still produces the artefact a human reviews.
  const markdown = renderMarkdown({
    report,
    brandNew,
    wentLive,
    wentDark,
    notReSwept,
    trackedTotal: knownMap.size + brandNew.length,
  });
  await mkdir(path.join('docs', 'scans'), { recursive: true });
  const mdPath = path.join('docs', 'scans', `SCAN-${stamp}.md`);
  await writeFile(mdPath, markdown, 'utf8');
  console.log(`\n[discover] report -> ${mdPath}`);

  if (DRY_RUN) {
    console.log('[discover] --dry-run: database not written.');
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
          not_reswept: notReSwept.map((d) => d.domain),
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
          // Explicit rather than relying on the column default, so the recorded
          // date is the sweep's date even if the insert is retried later.
          first_seen_at: report.finished_at,
          last_checked_at: report.finished_at,
        },
      ],
      { Prefer: 'resolution=merge-duplicates,return=representation' }
    );
  }

  // Keep liveness current for everything we re-observed, and stamp the
  // transition dates. taken_down_at is only set on the live -> dead edge, so it
  // records when a domain FIRST went down, not the last sweep that saw it down.
  for (const d of report.domains) {
    const prev = knownMap.get(d.domain);
    if (!prev) continue;

    const patch = { last_checked_at: report.finished_at };
    if (prev.is_live !== d.is_live) {
      patch.is_live = d.is_live;
      if (!d.is_live && !prev.taken_down_at) patch.taken_down_at = report.finished_at;
      // Back online: the previous takedown did not hold, so the stamp is no
      // longer true. The run history keeps the fact that it once went down.
      if (d.is_live && prev.taken_down_at) patch.taken_down_at = null;
    }

    await db.req('PATCH', `bp_domains?domain=eq.${encodeURIComponent(d.domain)}`, patch, {
      Prefer: 'return=minimal',
    });
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
