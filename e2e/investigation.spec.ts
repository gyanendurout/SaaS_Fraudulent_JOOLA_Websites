import { test, expect } from '@playwright/test';

test.describe('Overview', () => {
  test('loads and surfaces the active campaign', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /investigate a suspect domain/i })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /JOOLA impersonation cluster/i })
    ).toBeVisible();

    // The shared Elementor build is the headline correlation evidence.
    await expect(page.getByText('3.35.6').first()).toBeVisible();
  });

  test('separates the legitimate estate from threats', async ({ page }) => {
    await page.goto('/');
    const estate = page.getByRole('heading', { name: /verified joola estate/i });
    await expect(estate).toBeVisible();
    await expect(page.getByRole('link', { name: 'joola.com', exact: true })).toBeVisible();
  });
});

test.describe('Scan form — domain-label matching rule', () => {
  test('rejects a brand token that appears only in a query parameter', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/url or domain to investigate/i).fill('https://example.com/?ref=joola');
    await page.getByRole('button', { name: /investigate/i }).click();

    // Scoped by id: Next.js renders its own role="alert" route announcer.
    const alert = page.locator('#scan-error');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/no joola token found in the domain name/i);
    await expect(page).toHaveURL('/');
  });

  test('rejects a brand token that appears only in a path', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/url or domain to investigate/i).fill('https://marketplace.com/brands/joola');
    await page.getByRole('button', { name: /investigate/i }).click();
    await expect(page.locator('#scan-error')).toBeVisible();
  });

  test('accepts a real impersonation domain and opens its dossier', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/url or domain to investigate/i).fill('https://www.joola-vietnam.com/shop/');
    await page.getByRole('button', { name: /investigate/i }).click();

    // Generous timeout: in dev the target route compiles on first request, which
    // can exceed the default 5s. This is build latency, not app latency.
    await expect(page).toHaveURL(/\/domain\/joola-vietnam\.com$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'joola-vietnam.com' })).toBeVisible();
  });
});

test.describe('Dossier', () => {
  test('shows registry, platform and pricing evidence', async ({ page }) => {
    await page.goto('/domain/joolasg.com');

    await expect(page.getByRole('heading', { name: 'joolasg.com' })).toBeVisible();
    await expect(page.getByText('High risk').first()).toBeVisible();

    // Registrar abuse contact is what makes the takedown actionable.
    await expect(page.getByRole('link', { name: 'abuse3814@brandfocus.cn' })).toBeVisible();

    // Registered after the Singapore takedown.
    await expect(page.getByText('2026-08-27').first()).toBeVisible();

    await expect(page.getByRole('heading', { name: /platform fingerprint/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /observed pricing/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /triggered signals/i })).toBeVisible();
  });

  test('generates a takedown pack with Safe Browsing first', async ({ page }) => {
    await page.goto('/domain/joolasg.com');

    await expect(page.getByRole('heading', { name: /takedown pack/i })).toBeVisible();

    const first = page.getByRole('button', { name: /google safe browsing/i });
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute('aria-expanded', 'true');

    // Cloudflare is the cluster chokepoint and must be offered.
    await expect(page.getByRole('button', { name: /cloudflare abuse/i })).toBeVisible();
  });

  test('takedown sections expand and collapse accessibly', async ({ page }) => {
    await page.goto('/domain/joolasg.com');
    const cloudflare = page.getByRole('button', { name: /cloudflare abuse/i });

    await expect(cloudflare).toHaveAttribute('aria-expanded', 'false');
    await cloudflare.click();
    await expect(cloudflare).toHaveAttribute('aria-expanded', 'true');

    const panelId = await cloudflare.getAttribute('aria-controls');
    await expect(page.locator(`#${panelId}`)).toBeVisible();
  });

  test('legitimate domains are excluded from reporting', async ({ page }) => {
    await page.goto('/domain/joola.com');

    await expect(page.getByText('Legitimate').first()).toBeVisible();
    await expect(page.getByText(/excluded from reporting/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /takedown pack/i })).toHaveCount(0);
  });

  test('unknown domain returns 404', async ({ page }) => {
    const res = await page.goto('/domain/definitely-not-tracked-xyz.com');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Campaign view', () => {
  test('renders the timeline and flags the re-registration', async ({ page }) => {
    await page.goto('/cluster/joola-impersonation-2026-07');

    await expect(page.getByRole('heading', { name: /JOOLA impersonation cluster/i })).toBeVisible();
    await expect(page.getByText(/registered after singapore takedown/i)).toBeVisible();

    // Earliest member is the UK domain, not a SEA one. Scoped to the timeline
    // list — the same domain also appears under complaint routing below.
    const timeline = page.getByRole('list').filter({ hasText: 'joolauk.com' }).first();
    await expect(timeline.getByRole('link', { name: 'joolauk.com' })).toBeVisible();
  });

  test('groups complaint routing by registrar abuse contact', async ({ page }) => {
    await page.goto('/cluster/joola-impersonation-2026-07');
    await expect(page.getByRole('heading', { name: /complaint routing by registrar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'abuse@kouming.com' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'abuse@kh86.cn' })).toBeVisible();
  });
});

test.describe('Accessibility and layout', () => {
  test('has no horizontal overflow at mobile width', async ({ page }) => {
    for (const path of ['/', '/domains', '/domain/joolasg.com']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow, `horizontal overflow at ${path}`).toBe(false);
    }
  });

  test('skip link is reachable by keyboard', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /skip to main content/i })).toBeFocused();
  });

  test('has exactly one h1 per page', async ({ page }) => {
    for (const path of ['/', '/domains', '/domain/joolasg.com', '/cluster/joola-impersonation-2026-07']) {
      await page.goto(path);
      expect(await page.locator('h1').count(), `h1 count at ${path}`).toBe(1);
    }
  });
});
