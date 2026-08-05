import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
