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
    // This repo has independently rediscovered the same click-and-race-ahead persistence bug
    // four times now (commit 2348540, plus Tasks 1/3/5's own fix rounds) -- every other mutating
    // Page Object method in this sub-project now waits for its own persistence/navigation signal
    // instead of firing the click and returning immediately. This portal's own login couldn't be
    // verified live (no supplier test credentials available -- see the plan's blocker note), so
    // the exact request this app fires isn't confirmed; it's a reasonable guess that it uses
    // Supabase auth directly (matching this suite's other Supabase-backed forms, e.g.
    // admin-product-form.page.ts's save() hitting `.../rest/v1/...`), so this waits for the
    // matching `.../auth/v1/token` call. A generous timeout with a `.catch()` fallback means a
    // wrong guess degrades to "no extra wait" rather than a hang. endpoint unconfirmed — verify
    // against the real request on first live run.
    const loginSettled = this.page
      .waitForResponse((response) => response.url().includes('/auth/v1/token'), { timeout: 15000 })
      .catch(() => undefined);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await loginSettled;
  }

  getStockRow(label: string) {
    return this.page.getByRole('row', { name: new RegExp(label) });
  }

  async getSupplierStock(label: string): Promise<number> {
    const value = await this.getStockRow(label).getByRole('spinbutton').last().inputValue();
    return parseInt(value, 10) || 0;
  }

  async setSupplierStock(label: string, qty: number) {
    const row = this.getStockRow(label);
    await row.getByRole('spinbutton').last().fill(String(qty));
    // Same rationale as login() above: this suite's other mutating Page Object methods all wait
    // for their own persistence signal rather than racing ahead after a click, and this is the
    // one method in this sub-project that didn't. The exact endpoint this "save" button hits
    // couldn't be confirmed live (no supplier test credentials available), so this guesses it's
    // a REST call whose URL mentions "supplier" and tolerates a wrong guess via `.catch()`
    // rather than hanging. endpoint unconfirmed — verify against the real request on first live
    // run and tighten this matcher then.
    const saveSettled = this.page
      .waitForResponse(
        (response) => response.request().method() !== 'GET' && response.url().toLowerCase().includes('supplier'),
        { timeout: 15000 },
      )
      .catch(() => undefined);
    await row.getByRole('button', { name: /save/i }).click();
    await saveSettled;
  }

  async expectSignedIn() {
    await expect(this.page.getByText('Sign in')).toHaveCount(0);
  }
}
