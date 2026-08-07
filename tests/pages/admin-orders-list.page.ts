import { Page } from '@playwright/test';
import { env } from '../support/env';

export class AdminOrdersListPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(new URL('orders', env.adminUrl()).toString());
  }

  async searchAndOpen(orderNumber: string) {
    // The search box's filtering is debounced: typing triggers a delayed
    // `/api/st/orders?search=...` fetch (confirmed live via trace network capture) that the
    // list page uses to re-sync its own URL/query state. If that debounced fetch is still
    // pending when we click through to the order detail page, it can resolve afterwards and
    // silently navigate back to the list — a real race in the live app, reproduced ~2 times in
    // 12 runs when clicking immediately after `fill()`. Waiting for the debounced search
    // response before interacting further ensures the timer has already fired and won't land
    // after we've moved on.
    const searchSettled = this.page.waitForResponse(
      (response) => response.url().includes('/api/st/orders') && response.url().includes(`search=${orderNumber}`),
    );
    await this.page.getByPlaceholder('Search orders...').fill(orderNumber);
    await searchSettled;

    const row = this.page.getByRole('row', { name: new RegExp(orderNumber) });
    await row.getByRole('button').last().click();
    await this.page.getByRole('menuitem', { name: 'Order Details' }).click();
  }
}
