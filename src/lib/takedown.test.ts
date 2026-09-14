import { describe, test, expect } from 'vitest';
import { generateTakedownPack } from './takedown';
import type { Cluster, DomainRecord } from './types';

function makeDomain(over: Partial<DomainRecord> = {}): DomainRecord {
  return {
    domain: 'joolasg.com',
    matchKind: 'prefix',
    matchedIn: 'registrable',
    classification: 'suspect',
    discoverySource: 'dns_permutation',
    isLive: true,
    firstSeenAt: '2026-09-14T00:00:00Z',
    lastCheckedAt: '2026-09-14T00:00:00Z',
    takenDownAt: null,
    notes: null,
    infrastructure: {
      registrarName: 'Guizhou Zhongyu Zhike Network Technology Co., Ltd.',
      registrarIanaId: null,
      registrarAbuseEmail: 'abuse3814@brandfocus.cn',
      registrarAbusePhone: '+86.1065083477',
      registeredAt: '2026-08-27',
      expiresAt: '2027-08-27',
      domainStatus: ['active'],
      nameservers: ['henrik.ns.cloudflare.com'],
      dnsProvider: 'cloudflare',
      resolvedIps: ['104.21.61.17'],
      isProxied: true,
    },
    snapshot: {
      capturedAt: '2026-09-14T00:00:00Z',
      httpStatus: 200,
      finalUrl: 'https://joolasg.com/',
      responseHeaders: { server: 'cloudflare' },
      htmlSha256: 'ff5f82c0e2216a43'.repeat(4),
      htmlBytes: 311_000,
      techStack: {
        cms: 'wordpress',
        ecommerce: 'woocommerce',
        pageBuilder: 'elementor',
        pageBuilderVersion: '3.35.6',
      },
      currency: 'SGD',
      priceLadder: [{ regularPrice: 382.19, salePrice: 163.09, discountPct: 57.33 }],
      brandMentions: 1855,
    },
    signals: [],
    riskScore: 92,
    verdict: 'high_risk',
    clusterSlug: 'joola-impersonation-2026-07',
    priority: 80,
    ...over,
  };
}

const cluster: Cluster = {
  slug: 'joola-impersonation-2026-07',
  label: 'JOOLA impersonation cluster (Jul 2026 wave)',
  firstSeenAt: '2026-07-20',
  status: 'active',
  fingerprint: { page_builder_version: '3.35.6' },
  notes: 'test cluster',
  memberDomains: ['joolasg.com', 'joola-vietnam.com', 'joolauk.com'],
};

describe('generateTakedownPack', () => {
  test('puts Google Safe Browsing first as the immediate action', () => {
    const pack = generateTakedownPack(makeDomain());
    expect(pack[0]!.channel).toBe('safe_browsing');
    expect(pack[0]!.priority).toBe('immediate');
  });

  test('routes registrar complaint to the RDAP abuse contact', () => {
    const pack = generateTakedownPack(makeDomain());
    const registrar = pack.find((d) => d.channel === 'registrar');
    expect(registrar?.recipient).toBe('abuse3814@brandfocus.cn');
    expect(registrar?.submitVia).toBe('mailto:abuse3814@brandfocus.cn');
  });

  test('includes a Cloudflare complaint when origin is proxied', () => {
    const pack = generateTakedownPack(makeDomain());
    expect(pack.some((d) => d.channel === 'dns_provider')).toBe(true);
  });

  test('omits the Cloudflare complaint when not proxied', () => {
    const d = makeDomain();
    const pack = generateTakedownPack({
      ...d,
      infrastructure: { ...d.infrastructure!, isProxied: false, dnsProvider: 'namecheap' },
    });
    expect(pack.some((x) => x.channel === 'dns_provider')).toBe(false);
  });

  test('adds the right national CERT for the named market', () => {
    const my = generateTakedownPack(makeDomain({ domain: 'joola-malaysia.com' }));
    expect(my.find((d) => d.channel === 'national_cert')?.recipient).toBe(
      'cyber999@cybersecurity.my'
    );

    const inCert = generateTakedownPack(makeDomain({ domain: 'joola-india.com' }));
    expect(inCert.find((d) => d.channel === 'national_cert')?.recipient).toBe(
      'incident@cert-in.org.in'
    );
  });

  test('omits a CERT when the domain names no market', () => {
    const pack = generateTakedownPack(makeDomain({ domain: 'shopjoola.com' }));
    expect(pack.some((d) => d.channel === 'national_cert')).toBe(false);
  });

  test('includes collected evidence in the complaint body', () => {
    const body = generateTakedownPack(makeDomain())[0]!.body;
    expect(body).toContain('2026-08-27');
    expect(body).toContain('elementor 3.35.6');
    expect(body).toContain('104.21.61.17');
    expect(body).toContain('1855');
  });
});

describe('claim discipline — the thing that gets reports dismissed', () => {
  test('does NOT claim confirmed fraud without transactional evidence', () => {
    const body = generateTakedownPack(makeDomain({ classification: 'suspect' }))[0]!.body;
    expect(body).toMatch(/trademark|impersonation/i);
    expect(body).not.toMatch(/payment was captured/i);
    expect(body).not.toMatch(/confirmed fraudulent/i);
  });

  test('DOES claim confirmed fraud when transactional evidence exists', () => {
    const body = generateTakedownPack(
      makeDomain({ domain: 'joola-singapore.com', classification: 'confirmed_fraud' })
    )[0]!.body;
    expect(body).toMatch(/confirmed fraudulent/i);
    expect(body).toMatch(/payment was captured/i);
  });
});

describe('cluster context', () => {
  test('includes sibling domains and the re-registration warning', () => {
    const body = generateTakedownPack(makeDomain(), cluster)[0]!.body;
    expect(body).toContain('joola-vietnam.com');
    expect(body).toContain('joolauk.com');
    expect(body).toMatch(/per-domain suspension has proven insufficient/i);
  });

  test('omits cluster context when the domain is not a member', () => {
    const body = generateTakedownPack(makeDomain({ clusterSlug: null }), cluster)[0]!.body;
    expect(body).not.toContain('COORDINATED CAMPAIGN CONTEXT');
  });

  test('never lists the reported domain among its own related domains', () => {
    const body = generateTakedownPack(makeDomain(), cluster)[0]!.body;
    const related = body.split('Related domains: ')[1]?.split('\n')[0] ?? '';
    expect(related).not.toContain('joolasg.com');
  });
});

describe('degraded input', () => {
  test('produces a usable pack when infrastructure is missing', () => {
    const pack = generateTakedownPack(makeDomain({ infrastructure: null }));
    expect(pack.length).toBeGreaterThan(0);
    expect(pack[0]!.body).toContain('unknown');
    expect(pack.some((d) => d.channel === 'registrar')).toBe(false);
  });

  test('produces a usable pack when no snapshot was captured', () => {
    const pack = generateTakedownPack(makeDomain({ snapshot: null }));
    expect(pack.length).toBeGreaterThan(0);
    expect(pack[0]!.body).toContain('joolasg.com');
  });
});
