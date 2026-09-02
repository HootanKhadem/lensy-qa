import { Page, expect } from '@playwright/test';
import { env } from '../support/env';

export class SupplierPortalPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(new URL('en/supplier', env.storefrontUrl()).toString());
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }

  getStockRow(label: string) {
    return this.page.getByRole('row', { name: new RegExp(label) });
  }

  async setSupplierStock(label: string, qty: number) {
    const row = this.getStockRow(label);
    await row.getByRole('spinbutton').last().fill(String(qty));
    await row.getByRole('button', { name: /save/i }).click();
  }

  async expectSignedIn() {
    await expect(this.page.getByText('Sign in')).toHaveCount(0);
  }
}
