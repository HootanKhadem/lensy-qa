import { test as setup } from '@playwright/test';
import { AdminLoginPage } from '../pages/admin-login.page';
import { AdminDashboardPage } from '../pages/admin-dashboard.page';
import { StorefrontLoginModal } from '../pages/storefront-login-modal.page';
import { env } from '../support/env';

setup('authenticate as admin', async ({ page }) => {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.login(env.adminEmail(), env.adminPassword());
  await new AdminDashboardPage(page).expectLoaded();
  await page.context().storageState({ path: 'storage/admin.json' });
});

setup('authenticate as customer', async ({ page }) => {
  const loginModal = new StorefrontLoginModal(page);
  await loginModal.open();
  await loginModal.login(env.customerEmail(), env.customerPassword());
  await page.getByRole('button', { name: 'Sign in' }).waitFor({ state: 'detached' });
  await page.context().storageState({ path: 'storage/customer.json' });
});
