/**
 * Platform fingerprinting and fraud-signal scoring.
 *
 * All content detection is markup-anchored or word-boundary matched. An earlier
 * naive implementation using substring checks reported `cod` (matched inside
 * "code") and `vat` (inside "private") as payment/legal signals. Those results
 * were false and would have gone into a legal complaint. Never use bare
 * String.includes() for content signals.
 */

export interface TechStack {
  cms: string | null;
  ecommerce: string | null;
  pageBuilder: string | null;
  pageBuilderVersion: string | null;
}

export interface PricePair {
  regularPrice: number;
  salePrice: number;
  discountPct: number;
}

export interface FraudSignal {
  id: string;
  label: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  weight: number;
  triggered: boolean;
  detail?: string;
}

export function fingerprintHtml(html: string): TechStack {
  const h = html.toLowerCase();
  const stack: TechStack = {
    cms: null,
    ecommerce: null,
    pageBuilder: null,
    pageBuilderVersion: null,
  };

  if (h.includes('wp-content') || h.includes('wp-includes')) stack.cms = 'wordpress';
  if (h.includes('woocommerce')) stack.ecommerce = 'woocommerce';
  if (h.includes('cdn.shopify.com') || h.includes('myshopify')) {
    stack.cms = 'shopify';
    stack.ecommerce = 'shopify';
  }
  if (h.includes('wixstatic') || h.includes('wix.com')) stack.cms = 'wix';
  if (h.includes('squarespace')) stack.cms = 'squarespace';
  if (h.includes('bigcommerce')) stack.ecommerce = 'bigcommerce';
  if (h.includes('magento')) stack.ecommerce = 'magento';
  if (h.includes('prestashop')) stack.ecommerce = 'prestashop';

  const el = html.match(/elementor\s+(\d+\.\d+\.\d+)/i);
  if (el?.[1]) {
    stack.pageBuilder = 'elementor';
    stack.pageBuilderVersion = el[1];
  }
  return stack;
}

/**
 * Extract WooCommerce struck-through -> sale price pairs from markup.
 * Anchored on <del>/<ins> price elements, not free text.
 */
export function extractPriceLadder(html: string): PricePair[] {
  const re =
    /<del[^>]*>[\s\S]*?([\d][\d.,]{2,})\s*<\/bdi>[\s\S]*?<\/del>[\s\S]*?<ins[^>]*>[\s\S]*?([\d][\d.,]{2,})\s*<\/bdi>/g;

  // Deduplicated: storefronts repeat the same product across carousels, "related
  // items" and upsell blocks. Counting those repeats as distinct products would
  // overstate the catalogue in a complaint, so identical price pairs collapse.
  const seen = new Map<string, PricePair>();
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null && seen.size < 20) {
    const regularPrice = Number((m[1] ?? '').replace(/,/g, ''));
    const salePrice = Number((m[2] ?? '').replace(/,/g, ''));
    if (!Number.isFinite(regularPrice) || !Number.isFinite(salePrice)) continue;
    if (regularPrice <= 0 || salePrice <= 0 || salePrice > regularPrice) continue;

    const key = `${regularPrice}|${salePrice}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      regularPrice,
      salePrice,
      discountPct: Number((100 - (salePrice / regularPrice) * 100).toFixed(2)),
    });
  }
  return [...seen.values()];
}

/** Collapse duplicate price pairs from an already-stored ladder. */
export function dedupeLadder(pairs: PricePair[]): PricePair[] {
  const seen = new Map<string, PricePair>();
  for (const p of pairs) {
    seen.set(`${p.regularPrice}|${p.salePrice}`, p);
  }
  return [...seen.values()];
}

/** Count brand mentions using word boundaries, not raw substring counting. */
export function countBrandMentions(html: string, brand = 'joola'): number {
  const re = new RegExp(`\\b${brand}\\b`, 'gi');
  return (html.match(re) ?? []).length;
}

/**
 * Two ladders match if their discount percentages align within tolerance.
 * This is what proves a shared source catalogue across currencies — the
 * campaign's FX-converted prices differ but the discount shape is identical.
 */
export function laddersMatch(a: number[], b: number[], tolerance = 1.5): boolean {
  if (a.length < 3 || b.length < 3) return false;
  const n = Math.min(a.length, b.length);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) <= tolerance) hits++;
  }
  return hits / n >= 0.8;
}

export interface SignalInput {
  registeredAt?: string | null;
  isLive?: boolean | null;
  techStack?: TechStack | null;
  priceLadder?: PricePair[];
  brandMentions?: number;
  dnsProvider?: string | null;
  registrarCountryHint?: string | null;
  matchedClusterFingerprint?: boolean;
  isKnownLegitimate?: boolean;
  asOf?: Date;
}

/** Deterministic, auditable scoring. Claude interprets these — it does not invent them. */
export function evaluateSignals(input: SignalInput): FraudSignal[] {
  const asOf = input.asOf ?? new Date();
  const signals: FraudSignal[] = [];

  const add = (
    id: string,
    label: string,
    severity: FraudSignal['severity'],
    weight: number,
    triggered: boolean,
    detail?: string
  ) => signals.push({ id, label, severity, weight, triggered, detail });

  // Domain age
  let ageDays: number | null = null;
  if (input.registeredAt) {
    const reg = new Date(input.registeredAt);
    if (!Number.isNaN(reg.getTime())) {
      ageDays = Math.floor((asOf.getTime() - reg.getTime()) / 86_400_000);
    }
  }
  add(
    'domain_age',
    'Domain registered within 90 days',
    'high',
    20,
    ageDays !== null && ageDays < 90,
    ageDays !== null ? `${ageDays} days old` : 'registration date unknown'
  );

  // Cluster fingerprint — the strongest single signal we have
  add(
    'cluster_match',
    'Matches known impersonation cluster fingerprint',
    'critical',
    35,
    Boolean(input.matchedClusterFingerprint),
    input.techStack?.pageBuilderVersion
      ? `page builder ${input.techStack.pageBuilder} ${input.techStack.pageBuilderVersion}`
      : undefined
  );

  // Deep discounting
  const maxDiscount = Math.max(0, ...(input.priceLadder ?? []).map((p) => p.discountPct));
  add(
    'deep_discount',
    'Products listed >40% below reference price',
    'high',
    20,
    maxDiscount > 40,
    maxDiscount > 0 ? `max ${maxDiscount.toFixed(0)}% off` : 'no price data'
  );

  // Origin concealment
  add(
    'proxied_dns',
    'Origin concealed behind proxy DNS',
    'low',
    5,
    (input.dnsProvider ?? '').toLowerCase() === 'cloudflare',
    input.dnsProvider ?? undefined
  );

  // Heavy trademark use
  add(
    'heavy_brand_use',
    'Intensive trademark use on page',
    'medium',
    10,
    (input.brandMentions ?? 0) > 200,
    input.brandMentions ? `${input.brandMentions} mentions` : undefined
  );

  // Self-hosted storefront on a brand-adjacent domain
  add(
    'selfhosted_store',
    'Self-hosted e-commerce on brand-adjacent domain',
    'medium',
    10,
    input.techStack?.ecommerce === 'woocommerce',
    input.techStack?.ecommerce ?? undefined
  );

  return signals;
}

export function riskScore(signals: FraudSignal[], isKnownLegitimate = false): number {
  if (isKnownLegitimate) return 0;
  const total = signals.reduce((s, x) => s + x.weight, 0);
  const hit = signals.filter((s) => s.triggered).reduce((s, x) => s + x.weight, 0);
  if (total === 0) return 0;
  return Math.round((hit / total) * 100);
}

export type Verdict =
  | 'legitimate'
  | 'low_risk'
  | 'suspicious'
  | 'high_risk'
  | 'confirmed_fraud'
  | 'unreachable';

export function verdictFor(
  score: number,
  opts: { isKnownLegitimate?: boolean; isConfirmedFraud?: boolean; isLive?: boolean | null } = {}
): Verdict {
  if (opts.isKnownLegitimate) return 'legitimate';
  if (opts.isConfirmedFraud) return 'confirmed_fraud';
  if (opts.isLive === false) return 'unreachable';
  if (score >= 70) return 'high_risk';
  if (score >= 40) return 'suspicious';
  return 'low_risk';
}
