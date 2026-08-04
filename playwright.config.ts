import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
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
      use: { channel: 'chrome' },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      testDir: './tests/specs',
      dependencies: ['setup'],
    },
  ],
});
