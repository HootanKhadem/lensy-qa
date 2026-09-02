import { Page, expect } from '@playwright/test';
import { env } from '../support/env';

export class StorefrontProductPage {
  constructor(private page: Page) {}

  async goto(slug: string) {
    await this.page.goto(new URL(`en/product/${slug}`, env.storefrontUrl()).toString());
  }

  async expectProductName(name: string) {
    await expect(this.page.getByRole('heading', { name, exact: true })).toBeVisible();
  }

  // Confirmed live in `product-detail-client.tsx`'s rendered output: when `pre_order_enabled`
  // is true the add-to-cart button's accessible text becomes "Pre-order" (plus the estimated-
  // arrival string appended in a child `<span>` after a "·"), replacing "Add to Cart"/"Out of
  // Stock". Also confirmed live (see the products-inventory sub-project's Task 5 report) that,
  // contrary to this sub-project's original assumption, the storefront shows "Pre-order" purely
  // off `pre_order_enabled: true` -- it is NOT additionally gated on remaining stock being
  // exhausted (a live product with `stock_quantity: 10` and `pre_order_enabled: true` still
  // rendered "Pre-order", not "Add to Cart").
  async expectPreOrderButton(estimatedArrival?: string) {
    const button = this.page.getByRole('button', { name: /Pre-order/ });
    await expect(button).toBeVisible();
    if (estimatedArrival) {
      await expect(button).toContainText(estimatedArrival);
    }
  }

  // Confirmed live (network log): clicking "Pre-order" runs the exact same add-to-cart
  // sequence as the plain "Add to Cart" button -- `POST /api/cart` (creates a cart on first
  // add) followed by `POST /api/cart/items`. Also confirmed live, matching
  // `checkout.flow.ts`'s `placeOrder()` comment on the same endpoint: under this suite's normal
  // `fullyParallel` concurrent-worker execution against the one shared `CUSTOMER_EMAIL`
  // account, that `POST /api/cart/items` call can intermittently fail (an observed CSRF-token
  // race between workers, and/or the request getting aborted by an immediate subsequent
  // navigation) rather than the click genuinely not registering. Mirrors `placeOrder()`'s
  // one-retry-via-reload pattern and waits for the real response before returning, instead of
  // firing the click and letting a caller race ahead into `page.goto()` (confirmed live to
  // silently drop the item if it lands before this request settles).
  async clickPreOrder() {
    const button = this.page.getByRole('button', { name: /Pre-order/ });
    let body: { success?: boolean } | undefined;
    for (let attempt = 1; ; attempt++) {
      // A bounded per-attempt timeout here (rather than none) matters: confirmed live that this
      // `waitForResponse` can occasionally never resolve at all (no matching response ever
      // arrives, not even a failing one) on an otherwise-healthy run. Without a timeout that
      // hangs for the rest of the whole test's budget instead of retrying -- worse than the
      // failure this retry loop exists to catch. `body` staying undefined after a timeout falls
      // through to the same retry-or-fail handling as a `{success:false}` response.
      const addToCartSettled = this.page
        .waitForResponse(
          (response) => response.url().includes('/api/cart/items') && response.request().method() === 'POST',
          { timeout: 15000 },
        )
        .catch(() => undefined);
      await button.click();
      const response = await addToCartSettled;
      body = response ? await response.json() : undefined;
      if (body?.success || attempt >= 2) break;
      await this.page.reload({ waitUntil: 'commit' });
    }
    expect(body?.success, 'POST /api/cart/items did not report success (even after a retry)').toBe(true);
  }
}
