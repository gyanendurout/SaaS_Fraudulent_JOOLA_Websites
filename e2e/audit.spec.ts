/**
 * audit.spec.ts — exploratory / defensive testing.
 *
 * The investigation.spec.ts suite checks that intended behaviour works. This one
 * hunts for things nobody intended: console errors, failed requests, broken
 * links, duplicate DOM ids, unlabelled controls, dead pages, layout breakage at
 * awkward widths, and pages that throw only for certain data shapes.
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

const CLUSTER = '/cluster/joola-impersonation-2026-07';
const CORE_PAGES = ['/', '/domains', CLUSTER, '/domain/joolasg.com', '/domain/joola.com'];

/** Attach collectors for console errors, page exceptions and failed requests. */
function collect(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? 'unknown';
    // Browser-initiated cancellations are not app defects.
    if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(failure)) return;
    failedRequests.push(`${req.url()} — ${failure}`);
  });

  return { consoleErrors, pageErrors, failedRequests };
}

test.describe('Runtime health', () => {
  for (const path of CORE_PAGES) {
    test(`no console errors, exceptions or failed requests on ${path}`, async ({ page }) => {
      const { consoleErrors, pageErrors, failedRequests } = collect(page);
      const res = await page.goto(path, { waitUntil: 'networkidle' });

      expect(res?.status(), `${path} should return 200`).toBe(200);
      expect(pageErrors, `uncaught exceptions on ${path}`).toEqual([]);
      expect(consoleErrors, `console errors on ${path}`).toEqual([]);
      expect(failedRequests, `failed requests on ${path}`).toEqual([]);
    });
  }

  test('4xx and 5xx responses are not returned for any subresource', async ({ page }) => {
    const bad: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('definitely-not-tracked')) {
        bad.push(`${res.status()} ${res.url()}`);
      }
    });
    for (const path of CORE_PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' });
    }
    expect(bad).toEqual([]);
  });
});

test.describe('Link integrity', () => {
  test('every internal link on every core page resolves', async ({ page, request }) => {
    test.setTimeout(120_000);

    // Collect every internal href first, then verify. Interleaving page
    // navigation with request.get() disposes the request context mid-run.
    const seen = new Set<string>();
    for (const path of CORE_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const hrefs = await page.locator('a[href^="/"]').evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute('href')!).filter(Boolean)
      );
      for (const h of hrefs) seen.add(h);
    }

    expect(seen.size, 'expected internal links to crawl').toBeGreaterThan(10);

    const broken: string[] = [];
    for (const href of seen) {
      const res = await request.get(href, { failOnStatusCode: false });
      if (res.status() !== 200) broken.push(`${href} -> ${res.status()}`);
    }
    expect(broken, 'broken internal links').toEqual([]);
  });

  test('links that open a new tab are safe; mail links do not', async ({ page }) => {
    await page.goto('/domain/joolasg.com');
    // Expand every takedown panel so the submit links render.
    const buttons = page.locator('button[aria-controls^="takedown-panel-"]');
    for (let i = 0; i < (await buttons.count()); i++) {
      const b = buttons.nth(i);
      if ((await b.getAttribute('aria-expanded')) === 'false') await b.click();
    }

    // Anything opening a new tab must be https and carry noreferrer.
    const newTab = page.locator('a[target="_blank"]');
    const n = await newTab.count();
    expect(n, 'expected at least one web submission link').toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const rel = (await newTab.nth(i).getAttribute('rel')) ?? '';
      const href = (await newTab.nth(i).getAttribute('href')) ?? '';
      expect(rel, `rel on ${href}`).toContain('noreferrer');
      expect(href.startsWith('https://'), `${href} should be https`).toBe(true);
    }

    // mailto: must NOT open a new tab — it would strand an empty tab once the
    // mail client takes over.
    const mail = page.locator('a[href^="mailto:"]');
    const m = await mail.count();
    expect(m, 'expected registrar abuse mail links').toBeGreaterThan(0);
    for (let i = 0; i < m; i++) {
      expect(
        await mail.nth(i).getAttribute('target'),
        `mailto link ${await mail.nth(i).getAttribute('href')} should not target _blank`
      ).toBeNull();
    }
  });
});

test.describe('DOM correctness', () => {
  for (const path of CORE_PAGES) {
    test(`no duplicate element ids on ${path}`, async ({ page }) => {
      await page.goto(path);
      const dupes = await page.evaluate(() => {
        const counts = new Map<string, number>();
        for (const el of Array.from(document.querySelectorAll('[id]'))) {
          counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
        }
        return [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
      });
      expect(dupes).toEqual([]);
    });
  }

  test('every aria-controls points at an element that exists', async ({ page }) => {
    await page.goto('/domain/joolasg.com');
    const dangling = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[aria-controls]'))
        .map((el) => el.getAttribute('aria-controls')!)
        .filter((id) => !document.getElementById(id))
    );
    expect(dangling).toEqual([]);
  });

  test('every aria-labelledby / aria-describedby target exists', async ({ page }) => {
    for (const path of CORE_PAGES) {
      await page.goto(path);
      const dangling = await page.evaluate(() => {
        const out: string[] = [];
        for (const attr of ['aria-labelledby', 'aria-describedby']) {
          for (const el of Array.from(document.querySelectorAll(`[${attr}]`))) {
            for (const id of (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)) {
              if (!document.getElementById(id)) out.push(`${attr}=${id}`);
            }
          }
        }
        return out;
      });
      expect(dangling, `dangling aria references on ${path}`).toEqual([]);
    }
  });

  test('all interactive controls have an accessible name', async ({ page }) => {
    for (const path of CORE_PAGES) {
      await page.goto(path);
      const unnamed = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a, button, input, select, textarea'))
          .filter((el) => {
            const e = el as HTMLElement;
            if (e.hasAttribute('aria-hidden') || e.hasAttribute('hidden')) return false;
            const name =
              e.getAttribute('aria-label') ??
              (e.getAttribute('aria-labelledby')
                ? document.getElementById(e.getAttribute('aria-labelledby')!)?.textContent
                : null) ??
              (e.id ? document.querySelector(`label[for="${e.id}"]`)?.textContent : null) ??
              e.textContent;
            return !name || !name.trim();
          })
          .map((el) => `${el.tagName.toLowerCase()}#${el.id || '(no id)'}`)
      );
      expect(unnamed, `unnamed controls on ${path}`).toEqual([]);
    }
  });

  test('tables have a caption or accessible name', async ({ page }) => {
    for (const path of ['/domains', '/domain/joolasg.com', '/']) {
      await page.goto(path);
      const bad = await page.evaluate(() =>
        Array.from(document.querySelectorAll('table'))
          .filter((t) => !t.querySelector('caption') && !t.getAttribute('aria-label'))
          .map((_, i) => `table#${i}`)
      );
      expect(bad, `uncaptioned tables on ${path}`).toEqual([]);
    }
  });
});

test.describe('Data-shape resilience', () => {
  // Domains with no snapshot, no infrastructure, or odd status codes must not
  // throw — most of the triage queue has partial data.
  const PARTIAL_DATA_DOMAINS = [
    'joolastore.com',
    'joola-sports.com',
    'joolacambodia.com',
    'joola-hk.com',
    'joolamexico.com',
    'joola-singapore.com',
    'joolapaddle.com',
  ];

  for (const d of PARTIAL_DATA_DOMAINS) {
    test(`dossier renders for partial-data domain ${d}`, async ({ page }) => {
      const { pageErrors } = collect(page);
      const res = await page.goto(`/domain/${d}`);
      expect([200, 404], `${d} unexpected status`).toContain(res?.status());
      if (res?.status() === 200) {
        await expect(page.locator('h1')).toBeVisible();
      }
      expect(pageErrors, `exception rendering ${d}`).toEqual([]);
    });
  }

  test('malformed domain params are handled, not crashed', async ({ page }) => {
    for (const bad of ['..%2F..%2Fetc%2Fpasswd', 'a'.repeat(300), '%00', 'joola.com%20']) {
      const res = await page.goto(`/domain/${bad}`).catch(() => null);
      // Must be a clean 200 or 404 — never a 500.
      if (res) expect(res.status(), `status for ${bad}`).toBeLessThan(500);
    }
  });

  test('unknown cluster slug 404s cleanly', async ({ page }) => {
    const res = await page.goto('/cluster/does-not-exist');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Interaction', () => {
  test('takedown panel is keyboard operable', async ({ page }) => {
    await page.goto('/domain/joolasg.com');
    const btn = page.getByRole('button', { name: /cloudflare abuse/i });

    await btn.focus();
    await expect(btn).toBeFocused();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Enter');
    await expect(btn).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Enter');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  test('copy button reports success', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permission is chromium-specific here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/domain/joolasg.com');

    await page.getByRole('button', { name: /copy complaint/i }).first().click();
    await expect(page.getByText(/copied to clipboard/i)).toBeVisible();

    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('joolasg.com');
    expect(text).toContain('Subject:');
  });

  test('scan form recovers after an error', async ({ page }) => {
    await page.goto('/');
    const input = page.getByLabel(/url or domain to investigate/i);

    await input.fill('https://example.com/?ref=joola');
    await page.getByRole('button', { name: /investigate/i }).click();
    await expect(page.locator('#scan-error')).toBeVisible();

    // Typing again must clear the error state.
    await input.fill('joolasg.com');
    await expect(page.locator('#scan-error')).toHaveCount(0);
  });

  test('empty submission is rejected with a message', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /investigate/i }).click();
    await expect(page.locator('#scan-error')).toBeVisible();
  });
});

test.describe('Layout at awkward widths', () => {
  for (const width of [320, 375, 768, 1024, 1440, 1920]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of CORE_PAGES) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        const overflow = await page.evaluate(() => {
          const d = document.documentElement;
          return d.scrollWidth - d.clientWidth;
        });
        expect(overflow, `${path} overflows by ${overflow}px at ${width}`).toBeLessThanOrEqual(1);
      }
    });
  }

  test('tap targets on mobile meet minimum size', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll('button, input[type="text"]'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 40) out.push(`${el.tagName.toLowerCase()} h=${Math.round(r.height)}`);
      }
      return out;
    });
    expect(small).toEqual([]);
  });
});

test.describe('Content correctness', () => {
  test('legitimate estate never shows a takedown pack', async ({ page }) => {
    for (const d of ['joola.com', 'joolausa.com', 'joola.de']) {
      await page.goto(`/domain/${d}`);
      await expect(page.getByRole('heading', { name: /takedown pack/i })).toHaveCount(0);
      await expect(page.getByText(/excluded from reporting/i)).toBeVisible();
    }
  });

  test('confirmed-fraud language appears only where evidence exists', async ({ page }) => {
    // joola-singapore.com has the distributor test purchase.
    await page.goto('/domain/joola-singapore.com');
    const sg = await page.content();
    expect(sg).toMatch(/payment captured/i);

    // A cluster sibling without a test purchase must not claim it.
    await page.goto('/domain/joola-vietnam.com');
    const vn = await page.content();
    expect(vn).not.toMatch(/payment was captured/i);
  });

  test('registration dates are not shifted by a day', async ({ page }) => {
    // Regression guard for the DATE timezone bug.
    await page.goto('/domain/joolasg.com');
    await expect(page.getByText('2026-08-27').first()).toBeVisible();
    await expect(page.getByText('2026-08-26')).toHaveCount(0);

    await page.goto('/domain/joolauk.com');
    await expect(page.getByText('2026-07-20').first()).toBeVisible();
    await expect(page.getByText('2026-07-19')).toHaveCount(0);
  });

  test('price ladder has no duplicate rows', async ({ page }) => {
    await page.goto('/domain/joolasg.com');
    const rows = await page.locator('table tbody tr').evaluateAll((els) =>
      els.map((e) => e.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    );
    const priceRows = rows.filter((r) => /SGD/.test(r));
    expect(priceRows.length).toBeGreaterThan(0);
    expect(new Set(priceRows).size, 'duplicate price rows rendered').toBe(priceRows.length);
  });
});
