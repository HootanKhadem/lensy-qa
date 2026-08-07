import { Page, expect } from '@playwright/test';

export class StorefrontCheckoutPage {
  constructor(private page: Page) {}

  async fillAddress(details: {
    firstName: string;
    lastName: string;
    phone: string;
    street: string;
    city: string;
    area: 'Assima' | 'Hawally' | 'Sabah Alsalem';
  }) {
    await this.page.getByPlaceholder('First name *').fill(details.firstName);
    await this.page.getByPlaceholder('Last name *').fill(details.lastName);
    await this.page.getByPlaceholder('Phone number *').fill(details.phone);
    await this.page.getByPlaceholder('Street Address *').fill(details.street);
    await this.page.getByPlaceholder('City *').fill(details.city);
    // Live investigation: the area <select> has no accessible name (no aria-label, no
    // associated <label for>) — "Select area" is only the text of its placeholder <option>,
    // not a name Playwright's `name` filter can match. `getByRole('combobox', { name: ... })`
    // from the brief matches zero elements and hangs until timeout. It's the only combobox
    // on the checkout page at this point in the flow, so select it unscoped by role instead.
    await this.page.getByRole('combobox').selectOption(details.area);
  }

  async selectFreeShipping() {
    await this.page.locator('label', { hasText: 'Free Shipping' }).click();
  }

  async selectCashOnDelivery() {
    // Live investigation: an unscoped `label:has-text(/cash on delivery|COD/i)` (as originally
    // specified in the brief) false-matches the unrelated "Coupon Code" label elsewhere on the
    // page — "Code" contains the substring "Cod", so the case-insensitive /COD/i alternation
    // matches it. That would silently click the wrong element and mask the known payment-methods
    // bug instead of failing on it. Scoping the search to the "Payment Method" section's own
    // container avoids the false match — with the bug active, this section renders no labels at
    // all, so this correctly fails to find anything instead of clicking something unrelated.
    const paymentSection = this.page.getByRole('heading', { name: 'Payment Method' }).locator('xpath=..');
    await paymentSection.locator('label', { hasText: /cash on delivery|COD/i }).click();
  }

  async placeOrder() {
    await this.page.getByRole('button', { name: 'Place Order & Pay' }).click();
  }

  async expectOrderPlaced(): Promise<string> {
    // Confirmed live: order confirmation behavior after a successful placement was not
    // observable due to the known payment-methods bug. Investigate the real post-order
    // page/toast when writing this task (Playwright trace on the first real attempt will
    // show exactly what renders) and replace this with a concrete assertion + order
    // number extraction. Do not guess further than this comment — run it and look.
    throw new Error('expectOrderPlaced: implement against the real confirmation page once reachable');
  }
}
