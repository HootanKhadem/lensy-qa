import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';
import { StorefrontProductPage } from '../../pages/storefront-product.page';
import { env } from '../../support/env';

// This spec's filename mirrors Task 4's admin-side "toric-preorder-admin" naming for this
// sub-project, but the product used here is deliberately NOT a toric/contact-lens product --
// see the products-inventory sub-project's Task 5 report for the full live-investigation
// writeup. Short version: "Alcon Dailies Total1" (the toric-capable product Task 4 used)
// currently has zero rows in its per-power stock table and zero toric combinations, i.e. its
// "Contact Lens" stock UI has nothing to zero out live, and separately, live testing proved the
// storefront's "Pre-order" CTA is driven purely by the `pre_order_enabled` flag -- NOT
// additionally gated on remaining stock being exhausted (confirmed against a live product,
// "Vitorio", which has `stock_quantity: 10` and `pre_order_enabled: true` yet still renders
// "Pre-order", not "Add to Cart"). Since the pre-order code path this spec exercises doesn't
// actually depend on toric/lens-power stock at all, a plain product keeps the test focused on
// that path without the unrelated toric/lens-power complexity. "Cerruti 1881 CE8117" was
// confirmed live to be a plain sunglasses product (`is_contact_lens: false`, `is_eyeglasses:
// false`, `is_toric: false`, no "Buy with prescription lenses" storefront selector) not
// referenced by any other spec in this suite (checkout.flow.ts's shared "Carrera CA8044/S" was
// deliberately avoided).
test('a pre-order product shows the Pre-order CTA on the storefront and can be added to cart', async ({
  adminPage,
  customerPage,
}) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Cerruti 1881 CE8117');

  const form = new AdminProductFormPage(adminPage);
  await form.expectLoaded();
  const editUrl = adminPage.url();

  // Confirmed live (see the sub-project's Task 5 report -- now also called out in README.md's
  // "Known Environment Bugs"): clicking this form's Save button unconditionally clears the
  // product's category (`category_ids`/`category_id` both come back empty), even on a save that
  // never touched the Category widget at all. This is a real, pre-existing environment bug --
  // reproduced against "Carrera CA8044/S" too, whose category is already gone from earlier
  // products-inventory tasks' saves. Since this spec calls `save()` twice, re-affirming the
  // category checkbox immediately before each save is the only way to avoid adding to that
  // damage for the product this spec owns.
  const categoryCheckbox = adminPage.getByRole('checkbox', { name: 'Sun Glasses' });
  await expect(categoryCheckbox).toHaveAttribute('aria-checked', 'true');
  // A checkbox that already reads `aria-checked="true"` on page load (because it started
  // selected from the server) is NOT enough to survive the next Save -- confirmed live: even
  // with the checkbox visibly checked throughout, `save()` still cleared `category_ids` once
  // reloaded, unless the checkbox was actually toggled (off then back on) during this page
  // session. Whatever underlying form-state library backs this form appears to only include a
  // field in its submitted payload once the user has "touched" it, not merely because its
  // current value happens to already be correct. So this always toggles off-then-on (dirtying
  // it) rather than skipping when it's already checked.
  const reaffirmCategory = async () => {
    await categoryCheckbox.click();
    await expect(categoryCheckbox).toHaveAttribute('aria-checked', 'false');
    // A short settle delay between the two clicks and before returning: confirmed live that
    // this toggle can still lose the race and get excluded from the very next Save's payload
    // even though both clicks land and both intermediate `aria-checked` assertions pass --
    // i.e. the visual state is correct but whatever debounced form-state sync feeds the actual
    // submit hasn't caught up yet. There's no real event to wait on here (no network request
    // fires for a local checkbox toggle), so this is a pragmatic delay, not a proper signal.
    await adminPage.waitForTimeout(300);
    await categoryCheckbox.click();
    await expect(categoryCheckbox).toHaveAttribute('aria-checked', 'true');
    await adminPage.waitForTimeout(300);
  };

  // Capture the real original state before mutating anything (rather than assuming pre-order
  // starts off), mirroring toric-preorder-admin.spec.ts / supplier-stock.spec.ts's pattern of
  // restoring what was actually there.
  const originalEnabled = (await adminPage.getByLabel('Allow pre-order').getAttribute('aria-checked')) === 'true';

  // "Estimated arrival" only renders once "Allow pre-order" is on, so reveal it first to read
  // its real original value before overwriting it.
  await form.setAllowPreOrder(true);
  const originalArrival = await form.getPreOrderEstimatedArrival();

  await form.setPreOrderEstimatedArrival('2 weeks');
  await reaffirmCategory();
  await form.save();

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
  //
  // Confirmed live that even the toggle-dirty trick above doesn't make the category survive
  // Save with full reliability -- across repeated real runs it still occasionally came back
  // empty after this exact restore save, for reasons that couldn't be pinned down further as a
  // black box (no app source available). Rather than ship a fix that "usually" avoids further
  // damaging this product's category, this verifies the actual persisted result against the API
  // directly and retries the whole restore (fresh navigation included) up to 3 times, only
  // giving up with a hard failure if the category genuinely won't stick.
  const productIdMatch = editUrl.match(/\/products\/([^/]+)\/edit/);
  if (!productIdMatch) throw new Error(`Could not extract product id from edit URL: ${editUrl}`);
  const productApiUrl = new URL(`api/st/products/${productIdMatch[1]}`, env.adminUrl()).toString();

  let categoryRestored = false;
  for (let attempt = 1; attempt <= 3 && !categoryRestored; attempt++) {
    if (attempt > 1) {
      await adminPage.goto(editUrl);
      await form.expectLoaded();
    }
    await form.setPreOrderEstimatedArrival(originalArrival);
    await form.setAllowPreOrder(originalEnabled);
    await reaffirmCategory();
    await form.save();

    const response = await adminPage.request.get(productApiUrl);
    const body: { data?: { category_ids?: string[] } } = await response.json();
    categoryRestored = Array.isArray(body.data?.category_ids) && body.data.category_ids.length > 0;
  }
  expect(categoryRestored, 'category_ids came back empty after the restore save, even after 3 attempts').toBe(true);

  // Verify the rest of the restore persisted too, rather than relying on it implicitly. Using
  // `goto(editUrl)` again here rather than `adminPage.reload()` for the same reason as above --
  // the delayed post-save redirect to `/products` may have already landed by this point.
  await adminPage.goto(editUrl);
  await form.expectLoaded();
  await expect(adminPage.getByLabel('Allow pre-order')).toHaveAttribute(
    'aria-checked',
    originalEnabled ? 'true' : 'false',
  );
  await expect(categoryCheckbox).toHaveAttribute('aria-checked', 'true');
  // Re-enable it locally (unsaved) just to reveal "Estimated arrival" again and confirm the
  // restore wrote the original value rather than leaving a stale one behind.
  await form.setAllowPreOrder(true);
  await expect(adminPage.getByLabel('Estimated arrival')).toHaveValue(originalArrival);
});
