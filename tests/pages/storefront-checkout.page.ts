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
    // Scoped to the "Payment Method" section on purpose: an unscoped
    // `:has-text(/cash on delivery|COD/i)` false-matches the unrelated "Coupon Code" label
    // elsewhere on the page, because "Code" contains the substring "Cod" and the alternation is
    // case-insensitive. That would silently click the wrong element.
    //
    // The section renders each method as a <button> containing a <span> with the method name
    // (lensyweb checkout page, "Payment Method - Desktop" block) — there is no <label> in it. The
    // previous `locator('label', ...)` was written while the payment-methods API was returning 500
    // and the section rendered nothing at all, so a radio+label markup was assumed; it could never
    // match once methods actually rendered. There are two Payment Method blocks, desktop and
    // mobile, but the mobile one is under `lg:hidden` and Playwright runs at 1280px wide, so only
    // the desktop block is in the accessibility tree and the heading resolves to one element.
    const paymentSection = this.page.getByRole('heading', { name: 'Payment Method' }).locator('xpath=..');
    await paymentSection.getByRole('button', { name: /cash on delivery/i }).click();
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
