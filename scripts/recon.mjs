/**
 * recon.mjs — Phase 1 discovery + enrichment engine.
 *
 * Discovers candidate impersonation domains and enriches each with registrar,
 * DNS, hosting and platform-fingerprint data. Writes a single evidence JSON
 * that seed-supabase.mjs loads.
 *
 * The matching rule: "joola" must appear in the DOMAIN LABELS, never in a path
 * or query string. Enforced in classifyMatch() — we only ever inspect hostname
 * labels, so `example.com/?ref=joola` can never match by construction.
 *
 * Usage:  node scripts/recon.mjs [--out evidence/recon-YYYY-MM-DD.json]
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve4, resolve6 } from 'node:dns/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const BRAND = 'joola';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

// Known-good JOOLA properties. Anything here is never reported as a threat.
// joola.com is already tracked in the existing `sites` table (platform=shopify).
const KNOWN_LEGITIMATE = new Set(['joola.com', 'joolausa.com', 'joola.de']);

const GEO = [
  'singapore','malaysia','indonesia','vietnam','thailand','philippines','cambodia',
  'myanmar','laos','brunei','india','japan','korea','taiwan','hongkong','china',
  'australia','newzealand','asia','europe','uk','usa','canada','mexico','brazil',
  'germany','france','italy','spain','poland','turkey','dubai','uae','saudi',
  'sg','my','id','vn','th','ph','kh','in','jp','kr','tw','hk','au','nz',
];
const KEYWORDS = [
  'shop','store','official','outlet','sale','online','pro','sport','sports',
  'racket','paddle','pickleball','tabletennis','discount','promo',
];
const TLDS = ['com','net','shop','store','online','co'];

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

/**
 * Classify WHERE the brand token appears within the hostname's labels.
 * Only labels are inspected — never path, never query.
 */
export function classifyMatch(hostname) {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.');
  // Drop the public suffix. Two-part suffixes (co.uk, com.my) handled coarsely;
  // production swaps this for the full Public Suffix List.
  const TWO_PART = new Set(['co.uk', 'com.au', 'com.my', 'com.sg', 'co.id', 'co.th', 'com.vn']);
  const suffix2 = labels.slice(-2).join('.');
  const sld = TWO_PART.has(suffix2) ? labels[labels.length - 3] : labels[labels.length - 2];
  if (!sld || !sld.includes(BRAND)) return null;
  if (sld === BRAND) return 'exact_label';
  if (sld.startsWith(BRAND)) return 'prefix';
  if (sld.endsWith(BRAND)) return 'suffix';
  return 'embedded';
}

function buildCandidates() {
  const out = new Set();
  for (const token of [...GEO, ...KEYWORDS]) {
    for (const tld of TLDS) {
      out.add(`${BRAND}-${token}.${tld}`);
      out.add(`${BRAND}${token}.${tld}`);
      out.add(`${token}-${BRAND}.${tld}`);
      out.add(`${token}${BRAND}.${tld}`);
    }
  }
  for (const tld of TLDS) out.add(`${BRAND}.${tld}`);
  for (const d of KNOWN_LEGITIMATE) out.add(d);
  return [...out];
}

/* ------------------------------------------------------------------ *
 * Enrichment
 * ------------------------------------------------------------------ */

async function resolveHost(host) {
  const ips = [];
  await Promise.all([
    resolve4(host).then((a) => ips.push(...a)).catch(() => {}),
    resolve6(host).then((a) => ips.push(...a)).catch(() => {}),
  ]);
  return ips;
}

/** RDAP via the authoritative registry. Verisign for .com/.net; rdap.org otherwise. */
async function fetchRdap(domain) {
  const tld = domain.split('.').pop();
  const urls =
    tld === 'com' || tld === 'net'
      ? [`https://rdap.verisign.com/${tld}/v1/domain/${domain}`]
      : [`https://rdap.org/domain/${domain}`];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/rdap+json', 'User-Agent': 'joola-brandprotect/1.0' },
        signal: AbortSignal.timeout(25_000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const j = await res.json();

      const events = Object.fromEntries(
        (j.events ?? []).map((e) => [e.eventAction, e.eventDate?.slice(0, 10)])
      );
      let registrarName = null, registrarIanaId = null, abuseEmail = null, abusePhone = null;
      for (const ent of j.entities ?? []) {
        if (!(ent.roles ?? []).includes('registrar')) continue;
        for (const f of ent.vcardArray?.[1] ?? []) if (f[0] === 'fn') registrarName = f[3];
        registrarIanaId = Number(ent.publicIds?.[0]?.identifier) || null;
        for (const sub of ent.entities ?? []) {
          if (!(sub.roles ?? []).includes('abuse')) continue;
          for (const f of sub.vcardArray?.[1] ?? []) {
            if (f[0] === 'email') abuseEmail = f[3];
            if (f[0] === 'tel') abusePhone = String(f[3]).replace('tel:', '');
          }
        }
      }
      const nameservers = (j.nameservers ?? []).map((n) => n.ldhName.toLowerCase());
      const dnsProvider = nameservers[0]?.split('.').slice(-2, -1)[0] ?? null;

      return {
        registrar_name: registrarName,
        registrar_iana_id: registrarIanaId,
        registrar_abuse_email: abuseEmail,
        registrar_abuse_phone: abusePhone,
        registered_at: events.registration ?? null,
        expires_at: events.expiration ?? null,
        domain_status: j.status ?? [],
        nameservers,
        dns_provider: dnsProvider,
      };
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Fingerprint the e-commerce platform from the rendered-free HTML. */
export function fingerprint(html) {
  const h = html.toLowerCase();
  const stack = { cms: null, ecommerce: null, page_builder: null, page_builder_version: null };

  if (h.includes('wp-content') || h.includes('wp-includes')) stack.cms = 'wordpress';
  if (h.includes('woocommerce')) stack.ecommerce = 'woocommerce';
  if (h.includes('cdn.shopify.com') || h.includes('myshopify')) {
    stack.cms = 'shopify';
    stack.ecommerce = 'shopify';
  }
  if (h.includes('wixstatic')) stack.cms = 'wix';
  if (h.includes('squarespace')) stack.cms = 'squarespace';
  if (h.includes('bigcommerce')) stack.ecommerce = 'bigcommerce';
  if (h.includes('magento')) stack.ecommerce = 'magento';
  if (h.includes('prestashop')) stack.ecommerce = 'prestashop';

  const el = html.match(/elementor\s+(\d+\.\d+\.\d+)/i);
  if (el) {
    stack.page_builder = 'elementor';
    stack.page_builder_version = el[1];
  }
  return stack;
}

/**
 * Extract WooCommerce struck-through -> sale price pairs.
 * Word-boundary / markup-anchored, NOT naive substring matching — a plain
 * `html.includes('cod')` matches the word "code" and produces false positives.
 */
export function extractPriceLadder(html) {
  const re =
    /<del[^>]*>[\s\S]*?([\d][\d.,]{2,})\s*<\/bdi>[\s\S]*?<\/del>[\s\S]*?<ins[^>]*>[\s\S]*?([\d][\d.,]{2,})\s*<\/bdi>/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null && out.length < 12) {
    const regular = Number(m[1].replace(/,/g, ''));
    const sale = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(regular) || !Number.isFinite(sale) || regular <= 0) continue;
    out.push({
      regular_price: regular,
      sale_price: sale,
      discount_pct: Number((100 - (sale / regular) * 100).toFixed(2)),
    });
  }
  return out;
}

function detectCurrency(html) {
  if (/&#3647;|฿/.test(html)) return 'THB';
  if (/S\$/.test(html)) return 'SGD';
  if (/RM\s?\d/.test(html)) return 'MYR';
  if (/Rp\s?\d/.test(html)) return 'IDR';
  if (/₫|VND/.test(html)) return 'VND';
  if (/₱/.test(html)) return 'PHP';
  if (/₹/.test(html)) return 'INR';
  if (/€/.test(html)) return 'EUR';
  if (/&#36;|\$/.test(html)) return 'USD';
  return null;
}

async function probeSite(domain) {
  for (const scheme of ['https', 'http']) {
    try {
      const res = await fetch(`${scheme}://${domain}/`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30_000),
        redirect: 'follow',
      });
      const html = await res.text();
      return {
        http_status: res.status,
        final_url: res.url,
        response_headers: Object.fromEntries(res.headers.entries()),
        html_bytes: Buffer.byteLength(html),
        html_sha256: createHash('sha256').update(html).digest('hex'),
        tech_stack: fingerprint(html),
        currency: detectCurrency(html),
        price_ladder: extractPriceLadder(html),
        brand_mentions: (html.toLowerCase().match(/joola/g) ?? []).length,
      };
    } catch {
      /* try http */
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    })
  );
  return results;
}

async function main() {
  const outFlag = process.argv.indexOf('--out');
  const outPath =
    outFlag > -1
      ? process.argv[outFlag + 1]
      : `evidence/recon-${new Date().toISOString().slice(0, 10)}.json`;

  const started = new Date().toISOString();
  const candidates = buildCandidates();
  console.log(`[recon] testing ${candidates.length} candidate domains...`);

  const resolved = (
    await mapLimit(candidates, 60, async (d) => {
      const ips = await resolveHost(d);
      return ips.length ? { domain: d, ips } : null;
    })
  ).filter(Boolean);

  console.log(`[recon] ${resolved.length} resolve. Enriching...`);

  const domains = await mapLimit(resolved, 8, async ({ domain, ips }) => {
    const [rdap, site] = await Promise.all([fetchRdap(domain), probeSite(domain)]);
    return {
      domain,
      match_kind: classifyMatch(domain),
      discovery_source: KNOWN_LEGITIMATE.has(domain) ? 'manual' : 'dns_permutation',
      classification: KNOWN_LEGITIMATE.has(domain) ? 'legitimate' : 'suspect',
      is_live: Boolean(site && site.http_status && site.http_status < 500),
      resolved_ips: ips,
      infrastructure: rdap,
      snapshot: site,
    };
  });

  const report = {
    generated_at: started,
    finished_at: new Date().toISOString(),
    brand: BRAND,
    candidates_tested: candidates.length,
    candidates_resolved: resolved.length,
    domains: domains.sort((a, b) =>
      (a.infrastructure?.registered_at ?? '').localeCompare(b.infrastructure?.registered_at ?? '')
    ),
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[recon] wrote ${outPath}`);

  // Console summary: the Elementor-version correlation is the headline signal.
  const byBuilder = new Map();
  for (const d of domains) {
    const v = d.snapshot?.tech_stack?.page_builder_version;
    if (!v) continue;
    byBuilder.set(v, (byBuilder.get(v) ?? 0) + 1);
  }
  console.log('\n[recon] page-builder version clusters:');
  for (const [v, n] of [...byBuilder].sort((a, b) => b[1] - a[1])) {
    console.log(`   elementor ${v}: ${n} domain(s)`);
  }
}

// pathToFileURL normalises the Windows `file:///C:/...` form; a hand-built
// `file://${argv[1]}` string does not match it.
import { pathToFileURL } from 'node:url';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('[recon] fatal:', e);
    process.exit(1);
  });
}
