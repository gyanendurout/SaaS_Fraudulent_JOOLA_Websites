/**
 * Domain matching.
 *
 * Core rule: the brand token must appear in the DOMAIN LABELS — never in a path,
 * query string or fragment. This is enforced structurally: parseHost() discards
 * everything after the authority before matching can happen, so a URL like
 * `https://example.com/?ref=joola` cannot produce a match by construction.
 */

export type MatchKind = 'exact_label' | 'prefix' | 'suffix' | 'embedded';

export interface DomainMatch {
  hostname: string;
  registrableDomain: string;
  sld: string;
  publicSuffix: string;
  subdomains: string[];
  matchKind: MatchKind;
  /** Where the token was found. Subdomain hits rank below registrable-domain hits. */
  matchedIn: 'registrable' | 'subdomain';
}

/**
 * Multi-label public suffixes relevant to the markets in scope.
 * Production should load the full Public Suffix List; this covers the TLDs the
 * observed campaign actually uses plus the obvious SEA/EU ccTLD second levels.
 */
const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk',
  'com.au', 'net.au', 'org.au',
  'com.my', 'net.my', 'org.my',
  'com.sg', 'net.sg', 'org.sg',
  'co.id', 'web.id', 'or.id',
  'co.th', 'in.th',
  'com.vn', 'net.vn',
  'com.ph', 'net.ph',
  'co.in', 'net.in', 'org.in',
  'co.nz', 'net.nz', 'org.nz',
  'com.br', 'com.mx', 'com.tr',
  'co.jp', 'or.jp', 'co.kr',
  'com.hk', 'com.tw',
]);

/** Strip scheme, credentials, port, path, query and fragment. Returns bare hostname. */
export function parseHost(input: string): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();

  // Reject anything that is not http(s) if a scheme is present.
  const schemeMatch = value.match(/^([a-z][a-z0-9+.-]*):\/\//);
  if (schemeMatch) {
    if (schemeMatch[1] !== 'http' && schemeMatch[1] !== 'https') return null;
    value = value.slice(schemeMatch[0].length);
  }

  // Everything from the first /, ?, or # onward is NOT part of the authority.
  value = value.split(/[/?#]/)[0] ?? '';
  // Drop userinfo and port.
  value = value.split('@').pop() ?? '';
  value = value.split(':')[0] ?? '';
  value = value.replace(/\.$/, '');

  if (!value || !/^[a-z0-9.-]+$/.test(value)) return null;
  if (!value.includes('.')) return null;
  if (value.includes('..') || value.startsWith('.') || value.startsWith('-')) return null;

  return value;
}

export function splitDomain(hostname: string): {
  registrableDomain: string;
  sld: string;
  publicSuffix: string;
  subdomains: string[];
} | null {
  const labels = hostname.split('.');
  if (labels.length < 2) return null;

  const lastTwo = labels.slice(-2).join('.');
  const suffixLabelCount = MULTI_LABEL_SUFFIXES.has(lastTwo) ? 2 : 1;

  const sldIndex = labels.length - suffixLabelCount - 1;
  if (sldIndex < 0) return null;

  const sld = labels[sldIndex]!;
  const publicSuffix = labels.slice(sldIndex + 1).join('.');

  return {
    registrableDomain: `${sld}.${publicSuffix}`,
    sld,
    publicSuffix,
    subdomains: labels.slice(0, sldIndex),
  };
}

function kindFor(label: string, brand: string): MatchKind | null {
  if (!label.includes(brand)) return null;
  if (label === brand) return 'exact_label';
  if (label.startsWith(brand)) return 'prefix';
  if (label.endsWith(brand)) return 'suffix';
  return 'embedded';
}

/**
 * Match a URL or hostname against a brand token.
 * Returns null when the token does not appear in any domain label.
 */
export function matchBrandDomain(input: string, brand = 'joola'): DomainMatch | null {
  const hostname = parseHost(input);
  if (!hostname) return null;

  const parts = splitDomain(hostname);
  if (!parts) return null;

  const brandToken = brand.toLowerCase();

  const sldKind = kindFor(parts.sld, brandToken);
  if (sldKind) {
    return { hostname, ...parts, matchKind: sldKind, matchedIn: 'registrable' };
  }

  // A brand token in a subdomain (joola.cheap-shop.com) is a real impersonation
  // vector, but ranks lower — the registrable domain is what the operator owns.
  for (const sub of parts.subdomains) {
    const subKind = kindFor(sub, brandToken);
    if (subKind) {
      return { hostname, ...parts, matchKind: subKind, matchedIn: 'subdomain' };
    }
  }

  return null;
}

/** Confidence weight for triage ordering. Higher = more likely deliberate impersonation. */
export function matchPriority(match: DomainMatch): number {
  const base: Record<MatchKind, number> = {
    exact_label: 100,
    prefix: 80,
    suffix: 60,
    embedded: 40,
  };
  const score = base[match.matchKind];
  return match.matchedIn === 'subdomain' ? Math.round(score * 0.5) : score;
}
