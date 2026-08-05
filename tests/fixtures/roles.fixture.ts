import { test as base, expect, Page } from '@playwright/test';

type RoleFixtures = {
  adminPage: Page;
  customerPage: Page;
};

export const test = base.extend<RoleFixtures>({
  // Context options (recordVideo, viewport, channel, etc.) are only injected automatically
  // into contexts created via Playwright's built-in `context`/`page` fixtures. Since these
  // role fixtures create their own context via browser.newContext(), the project's `use`
  // options must be spread in explicitly or they're silently dropped (e.g. video never
  // records even with `video: 'retain-on-failure'` set at the project level).
  adminPage: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext({
      ...testInfo.project.use,
      storageState: 'storage/admin.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  customerPage: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext({
      ...testInfo.project.use,
      storageState: 'storage/customer.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
