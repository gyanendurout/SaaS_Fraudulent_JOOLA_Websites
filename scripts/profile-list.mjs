/**
 * profile-list.mjs — enrich an explicit list of domains and summarise it.
 *
 * Used when someone hands over a list (a distributor report, a legal brief)
 * rather than relying on a discovery sweep. Outputs a per-domain profile plus
 * counted rollups of abuse contacts and hosting platform, which is what a
 * takedown workflow actually needs to route complaints.
 *
 * Usage: node scripts/profile-list.mjs [file-with-one-domain-per-line]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve4 } from 'node:dns/promises';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const DEFAULT_LIST = `
joolauk.com
joola-malaysia.com
joola-philippines.com
joola-india.com
joolanz.com
joola-singapore.com
joolaindonesia.com
joola-vietnam.com
joola-thailand.com
joolafrance.com
joolasg.com
joolaindia.com
joolaphilippines.com
joolaph.com
joolasport.store
joolaau.com
joolaonline.shop
joola-pickleball.com
joolashop.shop
`;

/* ---------- lightweight local copies (scripts avoid the TS build) ---------- */

function fingerprint(html) {
  const h = html.toLowerCase();
  const s = { cms: null, ecommerce: null, pageBuilder: null, pageBuilderVersion: null };
  if (h.includes('wp-content') || h.includes('wp-includes')) s.cms = 'wordpress';
  if (h.includes('woocommerce')) s.ecommerce = 'woocommerce';
  if (h.includes('cdn.shopify.com') || h.includes('myshopify')) {
    s.cms = 'shopify';
    s.ecommerce = 'shopify';
  }
  if (h.includes('wixstatic') || h.includes('wix.com')) s.cms = 'wix';
  if (h.includes('squarespace')) s.cms = 'squarespace';
  if (h.includes('bigcommerce')) s.ecommerce = 'bigcommerce';
  const el = html.match(/elementor\s+(\d+\.\d+\.\d+)/i);
  if (el) {
    s.pageBuilder = 'elementor';
    s.pageBuilderVersion = el[1];
  }
  return s;
}

function ladder(html) {
  const re =
    /<del[^>]*>[\s\S]*?([\d][\d.,]{2,})\s*<\/bdi>[\s\S]*?<\/del>[\s\S]*?<ins[^>]*>[\s\S]*?([\d][\d.,]{2,})\s*<\/bdi>/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(html)) !== null && seen.size < 8) {
    const r = Number(m[1].replace(/,/g, ''));
    const s = Number(m[2].replace(/,/g, ''));
    if (!(r > 0 && s > 0 && s <= r)) continue;
    seen.set(`${r}|${s}`, Math.round(100 - (s / r) * 100));
  }
  return [...seen.values()];
}

async function rdap(domain) {
  const tld = domain.split('.').pop();
  const urls =
    tld === 'com' || tld === 'net'
      ? [`https://rdap.verisign.com/${tld}/v1/domain/${domain}`]
      : [`https://rdap.org/domain/${domain}`];
  for (const u of urls) {
    try {
      const res = await fetch(u, {
        headers: { Accept: 'application/rdap+json', 'User-Agent': 'joola-brandprotect/1.0' },
        signal: AbortSignal.timeout(25_000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const j = await res.json();
      const ev = Object.fromEntries(
        (j.events ?? []).map((e) => [e.eventAction, e.eventDate?.slice(0, 10)])
      );
      let registrar = null;
      let abuse = null;
      for (const e of j.entities ?? []) {
        if (!(e.roles ?? []).includes('registrar')) continue;
        for (const f of e.vcardArray?.[1] ?? []) if (f[0] === 'fn') registrar = f[3];
        for (const s of e.entities ?? []) {
          if (!(s.roles ?? []).includes('abuse')) continue;
          for (const f of s.vcardArray?.[1] ?? []) if (f[0] === 'email') abuse = f[3];
        }
      }
      const ns = (j.nameservers ?? []).map((n) => n.ldhName.toLowerCase());
      return {
        registrar,
        abuse,
        registered: ev.registration ?? null,
        expires: ev.expiration ?? null,
        nameservers: ns,
        dns: ns[0]?.split('.').slice(-2, -1)[0] ?? null,
      };
    } catch {
      /* next */
    }
  }
  return null;
}

async function probe(domain) {
  for (const host of [`www.${domain}`, domain]) {
    for (const scheme of ['https', 'http']) {
      try {
        const res = await fetch(`${scheme}://${host}/`, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(30_000),
          redirect: 'follow',
        });
        const html = await res.text();
        return {
          status: res.status,
          finalUrl: res.url,
          title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim().slice(0, 90),
          stack: fingerprint(html),
          discounts: ladder(html),
          brandMentions: (html.match(/\bjoola\b/gi) ?? []).length,
          bytes: Buffer.byteLength(html),
        };
      } catch {
        /* next */
      }
    }
  }
  return null;
}

const file = process.argv[2];
const list = (file ? await readFile(file, 'utf8') : DEFAULT_LIST)
  .split(/\r?\n/)
  .map((l) => l.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
  .filter(Boolean);

console.log(`profiling ${list.length} domains...\n`);

const rows = [];
for (const d of list) {
  const [reg, site, ips] = await Promise.all([
    rdap(d),
    probe(d),
    resolve4(d).catch(() => []),
  ]);
  rows.push({ domain: d, reg, site, ips });
  const stack = site?.stack.ecommerce ?? site?.stack.cms ?? '—';
  console.log(
    `  ${d.padEnd(26)} ${String(site?.status ?? 'dead').padEnd(5)} ${String(stack).padEnd(12)} ${reg?.abuse ?? '—'}`
  );
}

await writeFile(
  `evidence/profile-${new Date().toISOString().slice(0, 10)}.json`,
  JSON.stringify({ generated_at: new Date().toISOString(), rows }, null, 2),
  'utf8'
);

/* ---------- rollups ---------- */

const count = (fn) => {
  const m = new Map();
  for (const r of rows) {
    const k = fn(r) ?? '(unknown)';
    m.set(k, [...(m.get(k) ?? []), r.domain]);
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
};

const show = (title, entries) => {
  console.log(`\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`);
  for (const [k, ds] of entries) {
    console.log(`  ${String(ds.length).padStart(2)}  ${k}`);
    console.log(`      ${ds.join(', ')}`);
  }
};

show('ABUSE CONTACT', count((r) => r.reg?.abuse));
show('REGISTRAR', count((r) => r.reg?.registrar));
show('PLATFORM', count((r) => r.site?.stack.ecommerce ?? r.site?.stack.cms));
show('DNS PROVIDER', count((r) => r.reg?.dns));
show('PAGE BUILDER', count((r) => (r.site?.stack.pageBuilderVersion
  ? `${r.site.stack.pageBuilder} ${r.site.stack.pageBuilderVersion}`
  : null)));
show('LIVE STATUS', count((r) => (r.site ? `live (HTTP ${r.site.status})` : 'not responding')));

console.log(`\nwrote evidence/profile-${new Date().toISOString().slice(0, 10)}.json`);
