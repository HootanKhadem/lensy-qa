import { Page } from '@playwright/test';

export class StorefrontRegionPage {
  constructor(private page: Page) {}

  async switchToKuwait() {
    await this.page.locator('header').getByRole('button', { name: /USD|KWD/ }).click();
    await this.page.getByRole('button', { name: 'Kuwait' }).click();
  }
}
