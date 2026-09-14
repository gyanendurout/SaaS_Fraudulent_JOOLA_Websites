import { describe, test, expect } from 'vitest';
import {
  fingerprintHtml,
  extractPriceLadder,
  countBrandMentions,
  laddersMatch,
  evaluateSignals,
  riskScore,
  verdictFor,
  dedupeLadder,
} from './fingerprint';

describe('fingerprintHtml', () => {
  test('detects WordPress + WooCommerce + Elementor with version', () => {
    const html = `<link href="/wp-content/x.css"><div class="woocommerce"></div>
      <meta name="generator" content="Elementor 3.35.6; features: e_font_icon_svg">`;
    expect(fingerprintHtml(html)).toEqual({
      cms: 'wordpress',
      ecommerce: 'woocommerce',
      pageBuilder: 'elementor',
      pageBuilderVersion: '3.35.6',
    });
  });

  test('detects Shopify', () => {
    const s = fingerprintHtml('<script src="https://cdn.shopify.com/s/files/a.js">');
    expect(s.cms).toBe('shopify');
    expect(s.ecommerce).toBe('shopify');
  });

  test('detects Wix and Squarespace', () => {
    expect(fingerprintHtml('<img src="//static.wixstatic.com/a.png">').cms).toBe('wix');
    expect(fingerprintHtml('<!-- squarespace -->').cms).toBe('squarespace');
  });

  test('returns nulls for an unrecognised page', () => {
    expect(fingerprintHtml('<html><body>hello</body></html>')).toEqual({
      cms: null,
      ecommerce: null,
      pageBuilder: null,
      pageBuilderVersion: null,
    });
  });
});

describe('extractPriceLadder', () => {
  const woo = (a: string, b: string) =>
    `<del><span><bdi>${a}</bdi></span></del><ins><span><bdi>${b}</bdi></span></ins>`;

  test('extracts the real campaign ladder and computes discounts', () => {
    const html = woo('299.95', '128.00') + woo('229.95', '114.97') + woo('99.95', '69.97');
    const out = extractPriceLadder(html);
    expect(out).toHaveLength(3);
    expect(out[0]!.discountPct).toBeCloseTo(57.33, 1);
    expect(out[1]!.discountPct).toBeCloseTo(50.0, 1);
    expect(out[2]!.discountPct).toBeCloseTo(30.0, 1);
  });

  test('handles thousands separators (THB pricing)', () => {
    const out = extractPriceLadder(woo('9,755.54', '4,163.06'));
    expect(out[0]!.regularPrice).toBe(9755.54);
    expect(out[0]!.discountPct).toBeCloseTo(57.33, 1);
  });

  test('rejects sale price above regular price', () => {
    expect(extractPriceLadder(woo('50.00', '80.00'))).toHaveLength(0);
  });

  test('returns empty for markup without price elements', () => {
    expect(extractPriceLadder('<p>299.95 is a great price</p>')).toHaveLength(0);
  });
});

describe('countBrandMentions — word boundaries, not substrings', () => {
  test('counts whole-word brand mentions', () => {
    expect(countBrandMentions('JOOLA paddles by Joola. joola!')).toBe(3);
  });

  test('does not count the brand inside a larger word', () => {
    expect(countBrandMentions('joolaindonesia joolasg')).toBe(0);
  });

  // Regression: the bug that produced false payment/legal signals in recon.
  test('word-boundary logic does not match substrings like cod in code', () => {
    expect(countBrandMentions('<script>var code = 1</script>', 'cod')).toBe(0);
    expect(countBrandMentions('private variable', 'vat')).toBe(0);
  });
});

describe('laddersMatch', () => {
  test('matches identical discount shapes across currencies', () => {
    expect(laddersMatch([57.33, 50, 50, 30], [57.33, 50, 50, 30])).toBe(true);
  });

  test('tolerates small rounding differences from FX conversion', () => {
    expect(laddersMatch([57.33, 50.0, 30.0], [57.0, 50.4, 29.8])).toBe(true);
  });

  test('rejects clearly different ladders', () => {
    expect(laddersMatch([57, 50, 30], [10, 12, 15])).toBe(false);
  });

  test('requires at least three points to claim a match', () => {
    expect(laddersMatch([57, 50], [57, 50])).toBe(false);
  });
});

describe('evaluateSignals / riskScore / verdictFor', () => {
  const asOf = new Date('2026-09-14T00:00:00Z');

  test('scores a real campaign domain as high risk', () => {
    const signals = evaluateSignals({
      registeredAt: '2026-08-27',
      isLive: true,
      techStack: {
        cms: 'wordpress',
        ecommerce: 'woocommerce',
        pageBuilder: 'elementor',
        pageBuilderVersion: '3.35.6',
      },
      priceLadder: [{ regularPrice: 382.19, salePrice: 163.09, discountPct: 57.3 }],
      brandMentions: 1855,
      dnsProvider: 'cloudflare',
      matchedClusterFingerprint: true,
      asOf,
    });
    const score = riskScore(signals);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(verdictFor(score, { isLive: true })).toBe('high_risk');
  });

  test('scores a legitimate domain as zero regardless of signals', () => {
    const signals = evaluateSignals({
      registeredAt: '2001-01-01',
      isLive: true,
      techStack: { cms: 'shopify', ecommerce: 'shopify', pageBuilder: null, pageBuilderVersion: null },
      brandMentions: 900,
      asOf,
    });
    expect(riskScore(signals, true)).toBe(0);
    expect(verdictFor(0, { isKnownLegitimate: true })).toBe('legitimate');
  });

  test('flags domain age correctly', () => {
    const recent = evaluateSignals({ registeredAt: '2026-08-27', asOf });
    expect(recent.find((s) => s.id === 'domain_age')?.triggered).toBe(true);

    const old = evaluateSignals({ registeredAt: '2019-01-01', asOf });
    expect(old.find((s) => s.id === 'domain_age')?.triggered).toBe(false);
  });

  test('confirmed fraud overrides score-based verdict', () => {
    expect(verdictFor(10, { isConfirmedFraud: true })).toBe('confirmed_fraud');
  });

  test('dead site reports as unreachable', () => {
    expect(verdictFor(90, { isLive: false })).toBe('unreachable');
  });
});

describe('price ladder deduplication', () => {
  const woo = (a: string, b: string) =>
    `<del><span><bdi>${a}</bdi></span></del><ins><span><bdi>${b}</bdi></span></ins>`;

  // Storefronts repeat products across carousels and upsell blocks. Counting
  // those repeats would overstate the catalogue size in a legal complaint.
  test('collapses products repeated across page sections', () => {
    const html = woo('293.00', '146.49') + woo('293.00', '146.49') + woo('127.35', '89.15');
    const out = extractPriceLadder(html);
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.regularPrice)).toEqual([293, 127.35]);
  });

  test('dedupeLadder collapses already-stored duplicates', () => {
    const dup = [
      { regularPrice: 293, salePrice: 146.49, discountPct: 50 },
      { regularPrice: 293, salePrice: 146.49, discountPct: 50 },
      { regularPrice: 382.19, salePrice: 163.09, discountPct: 57 },
    ];
    expect(dedupeLadder(dup)).toHaveLength(2);
  });

  test('keeps genuinely different products at the same discount', () => {
    const html = woo('293.00', '146.50') + woo('200.00', '100.00');
    expect(extractPriceLadder(html)).toHaveLength(2);
  });
});
