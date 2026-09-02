import { Page, expect } from '@playwright/test';
import { env } from '../support/env';

export class AdminSuppliersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(new URL('suppliers', env.adminUrl()).toString());
  }

  async createSupplier(name: string) {
    // Confirmed live via network capture: the dialog's Save button submits a POST to the
    // admin app's own `/api/gl/suppliers` route (201 on success) — unlike the product edit
    // form's Save (which writes straight to Supabase REST), this one does go through the
    // admin app's API. Either way, the same race documented in
    // `admin-product-form.page.ts`'s `save()` applies: if a caller navigates away (e.g. this
    // spec's `list.goto()`) before the create request settles, the in-flight request gets
    // aborted and the supplier is silently never created. Wait for the response here so
    // callers can safely navigate immediately after `createSupplier()` returns.
    const createSettled = this.page.waitForResponse(
      (response) => response.url().includes('/api/gl/suppliers') && response.request().method() === 'POST',
    );
    await this.page.getByRole('button', { name: 'Add supplier' }).click();
    await this.page.getByRole('dialog').getByRole('textbox').first().fill(name);
    await this.page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
    const response = await createSettled;
    // `waitForResponse` matches on URL/method alone, so a 4xx/5xx response looks identical to a
    // successful one to every caller unless this checks the status too.
    expect(response.ok(), `POST to ${response.url()} returned ${response.status()}`).toBeTruthy();
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
