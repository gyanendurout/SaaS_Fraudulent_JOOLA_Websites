import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // `next start` answers the readiness probe before the first dynamic route
    // has booted its runtime, so the very first navigation of a run can exceed
    // the 30s default on a cold cache. Observed once in 112; raised rather than
    // papered over with a retry, which would hide a genuine regression too.
    navigationTimeout: 45_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    // Deliberately NOT reusing an existing server. Reuse silently tests whatever
    // is already on :3000 — a stale `next start` from an earlier build, or a dev
    // server — and reports the result as if it came from the current code. That
    // produced 31 phantom failures against code that had already been changed.
    // If the port is busy Playwright now fails loudly, which is the better bug.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
