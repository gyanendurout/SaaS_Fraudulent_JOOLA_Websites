/**
 * capture-evidence.mjs — preserve evidence before takedown removes it.
 *
 * For each live cluster domain: full-page screenshot, raw HTML, response
 * headers, and a SHA-256 of the HTML. Writes a manifest with UTC timestamps so
 * the capture can be attested later.
 *
 * This matters because takedown destroys the evidence. Once a registrar
 * suspends a domain, the page proving the infringement is gone. Capture first.
 *
 * Usage:
 *   node scripts/capture-evidence.mjs                 capture cluster members
 *   node scripts/capture-evidence.mjs joolasg.com ...  capture specific domains
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from '@playwright/test';

const CLUSTER_DOMAINS = [
  'joolauk.com',
  'joola-malaysia.com',
  'joola-india.com',
  'joola-philippines.com',
  'joolanz.com',
  'joola-vietnam.com',
  'joola-thailand.com',
  'joolafrance.com',
  'joolaindonesia.com',
  'joolasg.com',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const domains = args.length ? args : CLUSTER_DOMAINS;

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join('evidence', `capture-${stamp}`);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const manifest = {
  captured_at_utc: new Date().toISOString(),
  tool: 'playwright-chromium',
  user_agent: UA,
  note:
    'Unmodified captures of publicly served pages, retained as evidence for trademark ' +
    'and abuse complaints. Timestamps are UTC. html_sha256 is over the served HTML.',
  captures: [],
};

for (const domain of domains) {
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const entry = { domain, captured_at_utc: new Date().toISOString() };

  try {
    const response = await page.goto(`https://${domain}/`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });

    const html = await page.content();
    const hash = createHash('sha256').update(html).digest('hex');

    const shotPath = path.join(outDir, `${domain}.png`);
    const htmlPath = path.join(outDir, `${domain}.html`);

    await page.screenshot({ path: shotPath, fullPage: true });
    await writeFile(htmlPath, html, 'utf8');

    Object.assign(entry, {
      status: 'captured',
      http_status: response?.status() ?? null,
      final_url: page.url(),
      title: await page.title(),
      html_sha256: hash,
      html_bytes: Buffer.byteLength(html),
      screenshot: path.basename(shotPath),
      html_file: path.basename(htmlPath),
      response_headers: response ? await response.allHeaders() : {},
    });
    console.log(`  captured  ${domain.padEnd(24)} sha256:${hash.slice(0, 16)}…`);
  } catch (e) {
    Object.assign(entry, { status: 'failed', error: String(e).slice(0, 160) });
    console.log(`  FAILED    ${domain.padEnd(24)} ${String(e).slice(0, 60)}`);
  }

  manifest.captures.push(entry);
  await context.close();
}

await browser.close();

const manifestPath = path.join(outDir, 'manifest.json');
await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

const ok = manifest.captures.filter((c) => c.status === 'captured').length;
console.log(`\n${ok}/${domains.length} captured -> ${outDir}/`);
console.log(`manifest: ${manifestPath}`);
