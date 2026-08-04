import { test as setup } from '@playwright/test';
import { AdminLoginPage } from '../pages/admin-login.page';
import { AdminDashboardPage } from '../pages/admin-dashboard.page';
import { env } from '../support/env';

setup('authenticate as admin', async ({ page }) => {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.login(env.adminEmail(), env.adminPassword());
  await new AdminDashboardPage(page).expectLoaded();
  await page.context().storageState({ path: 'storage/admin.json' });
});
