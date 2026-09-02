import { Page } from '@playwright/test';
import { env } from '../support/env';

export class AdminProductsListPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(new URL('products', env.adminUrl()).toString());
  }

  async searchAndOpenEdit(productName: string) {
    await this.page.getByPlaceholder('Search products...').fill(productName);
    const row = this.page.getByRole('row', { name: new RegExp(productName) });
    await row.getByRole('button').last().click();
    await this.page.getByRole('menuitem', { name: 'Edit' }).click();
  }
}
