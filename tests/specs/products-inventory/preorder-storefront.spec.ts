import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';
import { StorefrontProductPage } from '../../pages/storefront-product.page';
import { env } from '../../support/env';

// Renamed from "toric-preorder-storefront.spec.ts" (see I8 in the products-inventory final
// review): the product used here is deliberately NOT a toric/contact-lens product — see the
// products-inventory sub-project's Task 5 report for the full live-investigation writeup. Short
// version: "Alcon Dailies Total1" (the toric-capable product Task 4 used) currently has zero rows
// in its per-power stock table and zero toric combinations, i.e. its "Contact Lens" stock UI has
// nothing to zero out live, and separately, live testing proved the storefront's "Pre-order" CTA
// is driven purely by the `pre_order_enabled` flag -- NOT additionally gated on remaining stock
// being exhausted. Since the pre-order code path this spec exercises doesn't actually depend on
// toric/lens-power stock at all, a plain product keeps the test focused on that path without the
// unrelated toric/lens-power complexity. "Cerruti 1881 CE8117" was confirmed live to be a plain
// sunglasses product (`is_contact_lens: false`, `is_eyeglasses: false`, `is_toric: false`, no
// "Buy with prescription lenses" storefront selector) not referenced by any other spec in this
// suite. Real toric/astigmatism coverage now lives in toric-stock-entry.spec.ts, against a
// product genuinely confirmed live to have "Toric / Astigmatism" enabled.
const PRODUCT_NAME = 'Cerruti 1881 CE8117';
const CATEGORY_NAME = 'Sun Glasses';

test('a pre-order product shows the Pre-order CTA on the storefront and can be added to cart', async ({
  adminPage,
  customerPage,
}) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit(PRODUCT_NAME);

  const form = new AdminProductFormPage(adminPage);
  await form.expectLoaded();
  const editUrl = adminPage.url();

  // Capture the real original state before mutating anything (rather than assuming pre-order
  // starts off), mirroring preorder-admin.spec.ts / supplier-stock.spec.ts's pattern of
  // restoring what was actually there.
  const originalEnabled = await form.getAllowPreOrder();

  // "Estimated arrival" only renders once "Allow pre-order" is on, so reveal it first to read
  // its real original value before overwriting it.
  await form.setAllowPreOrder(true);
  const originalArrival = await form.getPreOrderEstimatedArrival();

  await form.setPreOrderEstimatedArrival('2 weeks');
  // Confirmed live (see README's "Known Environment Bugs"): save() unconditionally clears this
  // product's category unless it's deliberately re-affirmed first. This defense originally lived
  // only in this spec; it's now hoisted onto AdminProductFormPage (see C1 in the final review)
  // so every products-inventory spec that saves a product with a real category gets it too.
  await form.saveReaffirmingCategory(CATEGORY_NAME);

  const product = new StorefrontProductPage(customerPage);
  await product.goto('cerruti-ce8117');
  await product.expectPreOrderButton('2 weeks');
  await product.clickPreOrder();

  // Confirmed live in Foundation: the cart button's accessible name is `title="Cart"`, which
  // becomes unstable once non-empty (see docs/testid-requests.md) -- assert via the cart page's
  // own contents instead of the button's name. Confirmed in source: the cart page lives at
  // src/app/[locale]/cart/, i.e. `${STOREFRONT_URL}en/cart` -- also confirmed live by actually
  // loading it during this task's investigation.
  await customerPage.goto(new URL('en/cart', env.storefrontUrl()).toString());
  // Confirmed live: the cart page can render "Cerruti 1881 CE8117" twice (the actual cart line
  // item plus a recommended-products entry elsewhere on the page) -- `.first()` avoids a strict
  // mode violation without depending on unstable class names to disambiguate.
  await expect(customerPage.getByText('Cerruti 1881 CE8117').first()).toBeVisible();

  // Cleanup (flagged in the final review): clickPreOrder() above adds a line to this shared
  // customer account's cart, and every later spec that calls placeOrder() (e.g.
  // checkout.flow.ts) would otherwise pick up a stray extra Cerruti line -- confirmed live this
  // had already piled up to 26 units from repeated past runs before this fix. Remove just that
  // line here via the same trash-icon button a real customer would use (confirmed live via
  // network capture: it fires `DELETE /api/cart/items`, distinct from the quantity +/- steppers
  // next to it, which are separate buttons in a sibling container). Scoped the same way
  // saveReaffirmingCategory() scopes the toric table: `.last()` on a "contains this text and a
  // button" filter resolves to the innermost matching container, isolating this line's own trash
  // button from the unrelated recommended-products mention of the same product name.
  const removeSettled = customerPage.waitForResponse(
    (response) => response.url().includes('/api/cart/items') && response.request().method() === 'DELETE',
  );
  await customerPage
    .locator('div')
    .filter({ hasText: 'Cerruti 1881 CE8117' })
    .filter({ has: customerPage.getByRole('button') })
    .last()
    .getByRole('button')
    .first()
    .click();
  await removeSettled;

  // Confirmed live: a successful Save fires a delayed client-side redirect back to the products
  // list a few seconds later (not immediately) -- harmless for other specs in this suite because
  // they call `adminPage.reload()` right after `save()`, which lands before the timer fires. This
  // spec instead spends several real seconds over on `customerPage` verifying the storefront
  // side, which is long enough for that redirect to land and leave `adminPage` sitting on
  // `/products` with none of the edit form's fields present -- silently hanging forever on the
  // next `getByLabel(...).fill()` (no explicit action timeout is configured anywhere in this
  // suite) instead of failing fast. Re-opening the edit page explicitly here, rather than
  // assuming `adminPage` is still where `save()` left it, avoids relying on that redirect's exact
  // timing at all.
  await adminPage.goto(editUrl);
  await form.expectLoaded();

  // Restore: write back the captured original arrival value and pre-order flag, so this
  // catalog product isn't left mutated. The fresh navigation above already lands with "Allow
  // pre-order" on and "Estimated arrival" showing "2 weeks" (the just-saved server state), so
  // "Estimated arrival" is already visible to overwrite here.
  await form.setAllowPreOrder(true);
  await form.setPreOrderEstimatedArrival(originalArrival);
  await form.setAllowPreOrder(originalEnabled);
  await form.saveReaffirmingCategory(CATEGORY_NAME);

  // Verify the rest of the restore persisted too, rather than relying on it implicitly. Using
  // `goto(editUrl)` again here rather than `adminPage.reload()` for the same reason as above --
  // the delayed post-save redirect to `/products` may have already landed by this point.
  await adminPage.goto(editUrl);
  await form.expectLoaded();
  await expect(adminPage.getByLabel('Allow pre-order')).toHaveAttribute(
    'aria-checked',
    originalEnabled ? 'true' : 'false',
  );
  // Re-enable it locally (unsaved) just to reveal "Estimated arrival" again and confirm the
  // restore wrote the original value rather than leaving a stale one behind.
  await form.setAllowPreOrder(true);
  await expect(adminPage.getByLabel('Estimated arrival')).toHaveValue(originalArrival);
});
