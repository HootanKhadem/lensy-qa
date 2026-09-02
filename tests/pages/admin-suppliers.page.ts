import { Page, expect } from '@playwright/test';
import { env } from '../support/env';

export class AdminSuppliersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(new URL('suppliers', env.adminUrl()).toString());
  }

  async createSupplier(name: string) {
    await this.page.getByRole('button', { name: 'Add supplier' }).click();
    await this.page.getByRole('dialog').getByRole('textbox').first().fill(name);
    await this.page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  }

  async expectSupplierListed(name: string) {
    await expect(this.page.getByText(name, { exact: true }).first()).toBeVisible();
  }

  async openInviteFor(supplierName: string) {
    const row = this.page.getByRole('row', { name: new RegExp(supplierName) });
    await row.getByRole('button', { name: 'Users' }).click();
  }

  async sendInvite(email: string) {
    await this.page.getByPlaceholder('email@supplier.com').fill(email);
    await this.page.getByRole('button', { name: 'Send invite' }).click();
  }
}
