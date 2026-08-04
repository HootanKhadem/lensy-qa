import { Page, expect } from '@playwright/test';

export class AdminDashboardPage {
  constructor(private page: Page) {}

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(this.page.getByText('Welcome back, Test Admin')).toBeVisible();
  }
}
