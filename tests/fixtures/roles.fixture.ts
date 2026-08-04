import { test as base, expect, Page } from '@playwright/test';

type RoleFixtures = {
  adminPage: Page;
  customerPage: Page;
};

export const test = base.extend<RoleFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'storage/admin.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  customerPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'storage/customer.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
