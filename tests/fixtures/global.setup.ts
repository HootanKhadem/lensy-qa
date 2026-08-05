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
  // Positive signal instead of an absence-based check: the storefront header replaces the
  // "Sign in" trigger with an account-menu button once signed in. That button has no
  // visible text or aria-label (tracked in docs/testid-requests.md), but it does carry
  // aria-haspopup="menu" (its Radix dropdown-trigger role) — verified unique in the header
  // against the live site, both logged out (absent) and logged in (present).
  await page.locator('header button[aria-haspopup="menu"]').waitFor({ state: 'visible' });
  await page.context().storageState({ path: 'storage/customer.json' });
});
