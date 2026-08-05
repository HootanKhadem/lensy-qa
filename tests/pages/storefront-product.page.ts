import { Page, expect } from '@playwright/test';
import { env } from '../support/env';

export class StorefrontProductPage {
  constructor(private page: Page) {}

  async goto(slug: string) {
    await this.page.goto(new URL(`en/product/${slug}`, env.storefrontUrl()).toString());
  }

  async expectProductName(name: string) {
    await expect(this.page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
}
