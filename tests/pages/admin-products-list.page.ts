import { Page } from '@playwright/test';
import { env } from '../support/env';

export class AdminProductsListPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(new URL('products', env.adminUrl()).toString());
  }

  async searchAndOpenEdit(productName: string) {
    // The search box's filtering is debounced: typing triggers a delayed
    // `/api/st/products?search=...` fetch (confirmed live via trace network capture) that the
    // list page uses to re-sync its own URL/query state. If that debounced fetch is still
    // pending when we click through to the product edit page, it can resolve afterwards and
    // silently navigate back to the list — a real race in the live app, same as the orders
    // list pattern. Waiting for the debounced search response before interacting further
    // ensures the timer has already fired and won't land after we've moved on.
    const searchSettled = this.page.waitForResponse(
      (response) => response.url().includes('/api/st/products') && response.url().includes('search='),
    );
    await this.page.getByPlaceholder('Search products...').fill(productName);
    await searchSettled;

    // Escape regex metacharacters before building the row matcher: some catalog product names
    // used across products-inventory specs contain literal parentheses (e.g. "ACUVUE OASYS for
    // Astigmatism (6 Pack)"), which an unescaped `new RegExp(productName)` would silently
    // mis-parse as a capturing group instead of literal characters -- the row would then never
    // match. Names without special characters (the common case) are unaffected.
    const escapedName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = this.page.getByRole('row', { name: new RegExp(escapedName) });
    await row.getByRole('button').last().click();
    await this.page.getByRole('menuitem', { name: 'Edit' }).click();
  }
}
