import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Default is 30s. Bumped modestly: this suite's mutating Page Object methods now correctly
  // wait for their own persistence signal (waitForResponse / dialog-close / DOM-settle) instead
  // of firing a click and racing ahead (see admin-order-detail.page.ts, checkout.flow.ts), and
  // `checkout.flow.ts`'s `placeOrder()` also retries its add-to-cart step once on a confirmed
  // live CSRF-token race that occurs under this suite's normal `fullyParallel` concurrent-worker
  // execution against the one shared `CUSTOMER_EMAIL` account. All of that is legitimate added
  // robustness, not slack -- but it does add real wall-clock time, and under heavy parallel load
  // against the shared test backend a 30s budget was observed to occasionally run out mid-flow
  // (before ever reaching the known, separately-documented payment-methods bug this suite is
  // meant to stop at), producing a different/earlier failure than intended. 60s gives that
  // legitimately-slower flow enough headroom to reliably reach the real failure point instead
  // (confirmed via repeated full-suite runs at 45s that it still occasionally wasn't enough
  // under this suite's normal 8-worker default parallelism against the shared test backend).
  timeout: 60_000,
  reporter: [['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests/fixtures',
      testMatch: /global\.setup\.ts/,
      // Real admin/customer credentials are typed here via .fill(password) — Playwright's
      // trace/video/screenshot capture would record them (traces log literal fill() args
      // with no redaction) and this project's artifacts would otherwise flow into the
      // public gh-pages report. Recording stays fully off for this project only; the
      // chromium project below still gets trace/screenshot/video on failure.
      use: { channel: 'chrome', trace: 'off', video: 'off', screenshot: 'off' },
    },
    {
      name: 'chromium',
      // GitHub Actions ubuntu-latest runners ship Google Chrome preinstalled, so pinning
      // the 'chrome' channel avoids needing Playwright's own Chromium download in CI.
      // Running locally requires Google Chrome to be installed on the machine.
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      testDir: './tests/specs',
      dependencies: ['setup'],
    },
  ],
});
