import { test } from '../../fixtures/roles.fixture';
import { AdminDashboardPage } from '../../pages/admin-dashboard.page';
import { env } from '../../support/env';

test('admin can sign in and see the dashboard', async ({ adminPage }) => {
  await adminPage.goto(env.adminUrl());
  await new AdminDashboardPage(adminPage).expectLoaded();
});
