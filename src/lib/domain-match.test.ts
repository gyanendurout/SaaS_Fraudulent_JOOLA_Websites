import { describe, test, expect } from 'vitest';
import { parseHost, splitDomain, matchBrandDomain, matchPriority } from './domain-match';

describe('parseHost', () => {
  test('strips scheme, path, query and fragment', () => {
    expect(parseHost('https://www.joola-vietnam.com/shop/?a=1#x')).toBe('www.joola-vietnam.com');
  });

  test('strips port and userinfo', () => {
    expect(parseHost('http://user:pw@joolasg.com:8443/path')).toBe('joolasg.com');
  });

  test('rejects non-http schemes', () => {
    expect(parseHost('ftp://joola.com')).toBeNull();
    expect(parseHost('javascript:alert(1)')).toBeNull();
  });

  test('rejects hostnames without a dot', () => {
    expect(parseHost('localhost')).toBeNull();
  });

  test('rejects malformed input', () => {
    expect(parseHost('')).toBeNull();
    expect(parseHost('http://joola..com')).toBeNull();
    expect(parseHost('-joola.com')).toBeNull();
  });
});

describe('splitDomain', () => {
  test('handles single-label public suffix', () => {
    expect(splitDomain('joola-vietnam.com')).toMatchObject({
      registrableDomain: 'joola-vietnam.com',
      sld: 'joola-vietnam',
      publicSuffix: 'com',
      subdomains: [],
    });
  });

  test('handles multi-label public suffix', () => {
    expect(splitDomain('shop.joola.com.my')).toMatchObject({
      registrableDomain: 'joola.com.my',
      sld: 'joola',
      publicSuffix: 'com.my',
      subdomains: ['shop'],
    });
  });

  test('collects multiple subdomains', () => {
    expect(splitDomain('a.b.joola.com')?.subdomains).toEqual(['a', 'b']);
  });
});

describe('matchBrandDomain — the "main domain, not URL parameter" rule', () => {
  test('does NOT match brand in a query parameter', () => {
    expect(matchBrandDomain('https://example.com/?ref=joola')).toBeNull();
    expect(matchBrandDomain('https://example.com/search?q=joola+paddle')).toBeNull();
  });

  test('does NOT match brand in a path segment', () => {
    expect(matchBrandDomain('https://marketplace.com/brands/joola')).toBeNull();
    expect(matchBrandDomain('https://shopee.sg/joola-official')).toBeNull();
  });

  test('does NOT match brand in a fragment', () => {
    expect(matchBrandDomain('https://example.com/#joola')).toBeNull();
  });

  test('does NOT match brand in userinfo', () => {
    expect(matchBrandDomain('https://joola@evil.com/')).toBeNull();
  });

  test('matches brand as exact registrable label', () => {
    expect(matchBrandDomain('https://joola.com')).toMatchObject({
      matchKind: 'exact_label',
      matchedIn: 'registrable',
    });
  });

  test('matches real campaign domains as prefix', () => {
    for (const d of ['joola-vietnam.com', 'joolaindonesia.com', 'joolasg.com', 'joolauk.com']) {
      expect(matchBrandDomain(d)).toMatchObject({ matchKind: 'prefix', matchedIn: 'registrable' });
    }
  });

  test('matches suffix form', () => {
    expect(matchBrandDomain('shopjoola.com')).toMatchObject({ matchKind: 'suffix' });
    expect(matchBrandDomain('pickleball-joola.com')).toMatchObject({ matchKind: 'suffix' });
  });

  test('matches embedded form', () => {
    expect(matchBrandDomain('myjoolastore.com')).toMatchObject({ matchKind: 'embedded' });
  });

  test('matches brand in a subdomain but flags it as lower rank', () => {
    const m = matchBrandDomain('https://joola.cheap-paddles.com/');
    expect(m).toMatchObject({ matchedIn: 'subdomain', registrableDomain: 'cheap-paddles.com' });
  });

  test('returns null for unrelated domains', () => {
    expect(matchBrandDomain('https://selkirk.com')).toBeNull();
    expect(matchBrandDomain('https://google.com')).toBeNull();
  });

  test('is case insensitive', () => {
    expect(matchBrandDomain('HTTPS://JOOLA-Malaysia.COM')).toMatchObject({
      registrableDomain: 'joola-malaysia.com',
    });
  });
});

describe('matchPriority', () => {
  test('ranks exact label above prefix above embedded', () => {
    const p = (d: string) => matchPriority(matchBrandDomain(d)!);
    expect(p('joola.com')).toBeGreaterThan(p('joola-vietnam.com'));
    expect(p('joola-vietnam.com')).toBeGreaterThan(p('shopjoola.com'));
    expect(p('shopjoola.com')).toBeGreaterThan(p('myjoolastore.com'));
  });

  test('halves priority for subdomain matches', () => {
    expect(matchPriority(matchBrandDomain('joola.evil.com')!)).toBe(50);
  });
});
