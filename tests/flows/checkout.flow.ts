import { Page, expect } from '@playwright/test';
import { StorefrontRegionPage } from '../pages/storefront-region.page';
import { StorefrontCheckoutPage } from '../pages/storefront-checkout.page';
import { env } from '../support/env';

export async function placeOrder(
  page: Page,
  options?: {
    productSlug?: string;
    quantity?: number;
    couponCode?: string;
    area?: 'Assima' | 'Hawally' | 'Sabah Alsalem';
  },
): Promise<{ orderNumber: string }> {
  // Sensible defaults matching this flow's original hardcoded behavior when an override isn't
  // passed, so every existing caller keeps working unchanged.
  const productSlug = options?.productSlug ?? 'carrera-ca8044s';
  const area = options?.area ?? 'Hawally';

  // `quantity` and `couponCode` are accepted here (widening the signature for sub-projects that
  // build on this flow next) but intentionally NOT wired up to real UI interaction yet:
  //  - `couponCode`: no confirmed live selector exists for a coupon-code field. The only
  //    live-confirmed fact about it is negative -- `storefront-checkout.page.ts`'s
  //    `selectCashOnDelivery()` comment documents that an unscoped Cash-on-Delivery locator
  //    false-matches a "Coupon Code" label elsewhere on the page, i.e. the field exists
  //    somewhere, but its own selector was never investigated. Wiring it up is for a future
  //    sub-project once that field is investigated live.
  //  - `quantity`: a live-confirmed "-"/"+" stepper does exist next to the price on the product
  //    page (icon-only, no accessible name on either button), but wiring multi-quantity support
  //    through it couldn't be verified end-to-end in this task (checkout is still blocked by the
  //    known payment-methods bug, so a quantity>1 order can never be placed/inspected to confirm
  //    the stepper behaves as expected). Rather than ship an unverified guess, this accepts the
  //    option and always adds exactly 1 unit (matching current behavior) until a future
  //    sub-project can wire it up and verify it live.

  // customerPage starts blank (no storageState navigation) — load the storefront first
  // so the header (and its region-switcher button) actually exists to click.
  await page.goto(env.storefrontUrl());
  await new StorefrontRegionPage(page).switchToKuwait();

  // "Carrera CA8044/S" is a simple sunglasses product with no lens-power selection —
  // confirmed live to go straight to a plain "Add to Cart" button, unlike lens products
  // which open a power-selection modal. Using it keeps this flow free of that unrelated
  // complexity.
  await page.goto(new URL(`en/product/${productSlug}`, env.storefrontUrl()).toString());

  // Confirmed live (DOM + network inspection) that the header's cart-badge count is NOT a
  // running total of units in the cart -- it's the number of distinct cart LINE ITEMS. Adding
  // the same product a second time merges into the existing line (bumping that line's own
  // `quantity`, e.g. 3 -> 4) without changing the badge at all. Every `placeOrder()` call in
  // this suite defaults to the same product slug against the same shared `CUSTOMER_EMAIL`
  // account, so after the first-ever run the badge would never move again -- a badge-based
  // "increased by 1" assertion would be permanently wrong, not just fragile. (Also confirmed
  // live: once the cart is non-empty, the badge `<span>`'s text becomes part of the button's
  // *accessible name* too, so a role-based `getByRole('button', {name:'Cart'})` match breaks as
  // soon as anything is in the cart -- one more reason to avoid the badge.)
  //
  // A separate "read quantity via GET /api/cart before, then again after, expect baseline+1"
  // approach was also tried and rejected: confirmed live (by actually running this suite with
  // `fullyParallel` workers) that it's genuinely racy, not just theoretically -- concurrent test
  // workers share the same account's cart, so a worker's own "before" read can be stale by the
  // time its "after" poll runs, having missed another worker's concurrent add landing in
  // between. It produced real intermittent failures (e.g. expected 5, received 7) against
  // correctly-behaving code.
  //
  // Wait for the add-to-cart mutation to actually persist before navigating to checkout --
  // firing the click and immediately calling `page.goto()` can abort the in-flight request
  // outright (a `goto` cancels pending requests on the page being navigated away from).
  // Confirmed live (network log) that clicking "Add to Cart" fires `POST /api/cart` followed by
  // `POST /api/cart/items` -- waiting for the latter (the actual item-add) avoids that race.
  //
  // Confirms the add actually registered server-side by reading it straight out of THIS
  // request's own response body, rather than a separate (racy, as above) GET. Confirmed live
  // that `POST /api/cart/items` responds `{ success: true, data: { items: [...] } }`, where
  // `data` is the full, authoritative cart state as of immediately after this specific request's
  // own atomic server-side increment -- not shared/racing with any other worker's request, since
  // it's this call's own result. Asserting the item is present with a positive quantity (rather
  // than an exact delta, which would require an unreliable "before" baseline under parallel
  // execution) still catches the real failure mode this guards against: add-to-cart silently not
  // registering at all.
  //
  // One retry (fresh page reload, then click again) if the first attempt reports failure.
  // Confirmed live this genuinely happens under this suite's normal `fullyParallel` execution
  // (not just a theoretical worry): with several concurrent workers all authenticated as the same
  // shared `CUSTOMER_EMAIL` account from the same captured `storage/customer.json` state, one
  // worker's `POST /api/cart/items` intermittently comes back `{"success":false,"error":"Invalid
  // CSRF token"}` -- a session/CSRF-token race between workers sharing that one account, not an
  // add-to-cart bug. The exact same test passes every time when run alone (`--workers=1`),
  // confirming it's the shared-account concurrency, not the flow. A reload re-fetches a fresh
  // CSRF cookie for this worker's own browser context, and a real (non-transient) add-to-cart
  // failure would still fail identically on the retry and get caught below.
  let addToCartBody: { success?: boolean; data?: { items?: Array<{ product?: { slug?: string }; quantity?: number }> } };
  for (let attempt = 1; ; attempt++) {
    const addToCartSettled = page.waitForResponse(
      (response) => response.url().includes('/api/cart/items') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    const addToCartResponse = await addToCartSettled;
    addToCartBody = await addToCartResponse.json();
    if (addToCartBody?.success || attempt >= 2) break;
    // `waitUntil: 'commit'` -- the earliest point `reload()` can resolve at (as soon as the
    // response headers for the navigation arrive, before the browser even parses the HTML) --
    // rather than the default `'load'` (every image/font/analytics request finished) or
    // `'domcontentloaded'` (also tried; still waits for the page's own scripts to finish
    // executing). This retry only needs a fresh CSRF cookie to be set by the server's redirect/
    // response headers, not a fully interactive page -- the very next action (re-clicking "Add
    // to Cart") auto-waits for that button to exist regardless of which `waitUntil` was used
    // here, so nothing downstream needs the extra readiness `'load'`/`'domcontentloaded'` would
    // have provided. Every millisecond this retry itself costs is a millisecond closer to this
    // whole suite's shared timeout firing before ever reaching the real, separately-documented
    // payment-methods bug this flow is meant to stop at.
    await page.reload({ waitUntil: 'commit' });
  }
  expect(addToCartBody?.success, 'POST /api/cart/items did not report success (even after a retry)').toBe(true);
  const addedItem = (addToCartBody?.data?.items ?? []).find((item) => item.product?.slug === productSlug);
  expect(
    addedItem?.quantity,
    `Cart response has no line item (or a non-positive quantity) for "${productSlug}" right after adding it`,
  ).toBeGreaterThan(0);

  await page.goto(new URL('en/checkout', env.storefrontUrl()).toString());
  const checkout = new StorefrontCheckoutPage(page);
  await checkout.fillAddress({
    firstName: 'QA',
    lastName: 'Tester',
    phone: '50123456',
    street: 'Test Street 1',
    city: 'Kuwait City',
    area,
  });
  await checkout.selectFreeShipping();
  await checkout.selectCashOnDelivery();
  await checkout.placeOrder();

  const orderNumber = await checkout.expectOrderPlaced();
  return { orderNumber };
}
