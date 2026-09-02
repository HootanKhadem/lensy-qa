import { Page, expect } from '@playwright/test';

export class AdminProductFormPage {
  constructor(private page: Page) {}

  async expectLoaded() {
    await expect(this.page.getByRole('button', { name: 'Save' })).toBeVisible();
  }

  async save() {
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
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
}
