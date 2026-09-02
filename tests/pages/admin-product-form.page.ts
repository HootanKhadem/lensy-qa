import { Page, expect } from '@playwright/test';

export class AdminProductFormPage {
  constructor(private page: Page) {}

  async expectLoaded() {
    await expect(this.page.getByRole('button', { name: 'Save' })).toBeVisible();
  }

  async save() {
    // The Save button is disabled while the mutation is in-flight (`isSaving`). Wait for
    // the persistence to complete before returning, rather than just firing the click and
    // moving on — prevents callers from immediately doing `await adminPage.reload()` while
    // the PATCH is still in-flight (which would abort the request and lose the mutation).
    // Wait for the save API response to settle before returning. Confirmed live: the save
    // endpoint is a PATCH to Supabase REST API at `/rest/v1/st_products`.
    const saveSettled = this.page.waitForResponse(
      (response) => response.url().includes('/rest/v1/st_products') && response.request().method() === 'PATCH',
    );
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await saveSettled;
  }

  async getExpiryDate(): Promise<string> {
    return this.page.getByLabel('Expiry Date').inputValue();
  }

  async setExpiryDate(date: string) {
    await this.page.getByLabel('Expiry Date').fill(date);
  }

  async getSupplierStock(): Promise<number> {
    const value = await this.page.getByLabel('Supplier stock').inputValue();
    return parseInt(value, 10) || 0;
  }

  async setSupplierStock(qty: number) {
    await this.page.getByLabel('Supplier stock').fill(String(qty));
  }

  async getLinkedSupplier(): Promise<string> {
    return (await this.page.getByLabel('Linked supplier').textContent())?.trim() || '';
  }

  async setLinkedSupplier(name: string) {
    await this.page.getByLabel('Linked supplier').click();
    await this.page.getByRole('option', { name }).click();
  }

  async getAllowPreOrder(): Promise<boolean> {
    return (await this.page.getByLabel('Allow pre-order').getAttribute('aria-checked')) === 'true';
  }

  async setAllowPreOrder(enabled: boolean) {
    const toggle = this.page.getByLabel('Allow pre-order');
    const checked = await toggle.getAttribute('aria-checked');
    if ((checked === 'true') !== enabled) {
      await toggle.click();
    }
  }

  async setPreOrderEstimatedArrival(text: string) {
    await this.page.getByLabel('Estimated arrival').fill(text);
  }

  async getPreOrderEstimatedArrival(): Promise<string> {
    return this.page.getByLabel('Estimated arrival').inputValue();
  }

  // Confirmed live: adding/removing a toric entry only mutates the form's local React state
  // (a row appended to/removed from the "Toric Stock Combinations" table) — no network request
  // fires until the page's own Save button is clicked. Unlike save(), these don't need a
  // waitForResponse guard; persistence is entirely handled by the existing save()'s PATCH wait.
  // (Verified with a real Playwright run against the live product: no PATCH fires and the page
  // stays on the /edit URL across an add-then-delete cycle.)
  async addToricEntry(entry: { sphere: string; cylinder: string; axis: string; qty: number }) {
    await this.page.locator('select').filter({ hasText: 'Sphere (SPH)' }).selectOption({ label: entry.sphere });
    await this.page.locator('select').filter({ hasText: 'Cylinder (CYL)' }).selectOption({ label: entry.cylinder });
    await this.page.locator('select').filter({ hasText: 'Axis (AXIS)' }).selectOption({ label: entry.axis });
    await this.page.getByPlaceholder('Qty').fill(String(entry.qty));
    await this.page.getByRole('button', { name: 'Add', exact: true }).click();
  }

  // Scoped to the specific toric-combinations table (identified by its "AXIS" column header,
  // confirmed live) rather than any `<table>` on the page, since the form has other tables
  // elsewhere (e.g. the per-power "Lens Powers" table) that could otherwise be matched too.
  private toricTable() {
    return this.page.locator('table').filter({ hasText: 'AXIS' });
  }

  async getToricEntryCount(): Promise<number> {
    return this.toricTable().locator('tbody tr').count();
  }

  async deleteAllToricEntries() {
    // Confirmed live: each row's delete button has no aria-label/title but does carry a real
    // (if terse) accessible name from its visible "✕" text content, so it can be targeted by
    // role+name rather than a positional `.last()`.
    const MAX_ITERATIONS = 100;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const count = await this.getToricEntryCount();
      if (count === 0) return;
      await this.toricTable().locator('tbody tr').first().getByRole('button', { name: '✕' }).click();
    }
    throw new Error(`deleteAllToricEntries: still had entries left after ${MAX_ITERATIONS} delete attempts`);
  }
}
