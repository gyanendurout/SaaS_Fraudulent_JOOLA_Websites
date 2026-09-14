/**
 * screenshot.mjs — capture the UI at desktop and mobile widths.
 *
 * Used to visually review the interface, and to produce review artefacts.
 * Requires the app to be running (npm run start or npm run dev).
 *
 * Usage: node scripts/screenshot.mjs [outDir]
 */

import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const outDir = process.argv[2] ?? 'screenshots';
const base = process.env.BASE_URL ?? 'http://localhost:3000';

const SHOTS = [
  { name: 'overview', path: '/', width: 1440, height: 1150 },
  { name: 'dossier', path: '/domain/joolasg.com', width: 1440, height: 1700 },
  { name: 'campaign', path: '/cluster/joola-impersonation-2026-07', width: 1440, height: 1300 },
  { name: 'domains', path: '/domains', width: 1440, height: 1050 },
  { name: 'mobile-overview', path: '/', width: 390, height: 1250 },
  { name: 'mobile-dossier', path: '/domain/joolasg.com', width: 390, height: 1400 },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

for (const shot of SHOTS) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 1,
  });
  await page.goto(base + shot.path, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.screenshot({ path: `${outDir}/${shot.name}.png` });
  await page.close();
  console.log(`captured ${shot.name} (${shot.width}x${shot.height})`);
}

await browser.close();
console.log(`\nwrote ${SHOTS.length} screenshots to ${outDir}/`);
