/**
 * migrate.mjs — apply SQL migrations to Supabase Postgres.
 *
 * Tracks applied migrations in the project's existing `schema_migrations` table
 * (version, name, applied_at), matching the convention already in use.
 *
 * Usage:
 *   node scripts/migrate.mjs            apply pending migrations
 *   node scripts/migrate.mjs --status   list applied vs pending, change nothing
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = new URL('../supabase/migrations/', import.meta.url);

async function loadEnv() {
  const raw = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  if (!env.SUPABASE_DB_URL) throw new Error('.env.local missing SUPABASE_DB_URL');
  return env;
}

async function connect(url) {
  // Supabase requires TLS. The pooler presents a cert chain Node does not have a
  // root for, so verification is relaxed for this admin-only migration path.
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

async function ensureTracking(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      version    text primary key,
      name       text not null,
      applied_at timestamptz not null default now()
    );
  `);
}

async function main() {
  const env = await loadEnv();
  const statusOnly = process.argv.includes('--status');

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = await connect(env.SUPABASE_DB_URL);
  try {
    await ensureTracking(client);
    const { rows } = await client.query('select version from public.schema_migrations');
    const applied = new Set(rows.map((r) => r.version));

    const pending = files.filter((f) => !applied.has(f.split('_')[0]));

    console.log(`[migrate] ${files.length} migration file(s), ${applied.size} applied, ${pending.length} pending`);
    for (const f of files) {
      const v = f.split('_')[0];
      console.log(`   ${applied.has(v) ? '✓' : '·'} ${f}`);
    }
    if (statusOnly || pending.length === 0) return;

    for (const file of pending) {
      const version = file.split('_')[0];
      const sql = await readFile(new URL(file, MIGRATIONS_DIR), 'utf8');
      process.stdout.write(`[migrate] applying ${file} ... `);
      try {
        await client.query(sql);
        await client.query(
          'insert into public.schema_migrations (version, name) values ($1, $2) on conflict (version) do nothing',
          [version, file]
        );
        console.log('ok');
      } catch (e) {
        console.log('FAILED');
        console.error(`[migrate] ${file}: ${e.message}`);
        throw e;
      }
    }
    console.log('[migrate] done.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[migrate] fatal:', e.message ?? e);
  process.exitCode = 1;
});
