import { describe, test, expect } from 'vitest';
import { classifyMatch, KNOWN_LEGITIMATE as SCAN_ESTATE } from '../../scripts/recon.mjs';
import { KNOWN_LEGITIMATE } from '@/data/repository';

// Confirmed by JOOLA as its own properties. Anything here is never reported.
const ESTATE = [
  'joola.com',
  'joolausa.com',
  'joola.de',
  'joola.ca',
  'joola.com.au',
  'joola.in',
  'joola.com.br',
  'joola.co.jp',
  'joola.tw',
];

describe('verified JOOLA estate', () => {
  test('the dashboard treats every confirmed domain as legitimate', () => {
    expect([...KNOWN_LEGITIMATE].sort()).toEqual([...ESTATE].sort());
  });

  test('the scan uses the same list as the dashboard', () => {
    expect([...SCAN_ESTATE].sort()).toEqual([...KNOWN_LEGITIMATE].sort());
  });

  test('the scan reads two-part country suffixes as a bare brand label', () => {
    for (const d of ['joola.com.au', 'joola.com.br', 'joola.co.jp']) {
      expect(classifyMatch(d)).toBe('exact_label');
    }
  });
});
