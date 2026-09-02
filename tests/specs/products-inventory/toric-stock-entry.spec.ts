import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

// This is the first real toric/astigmatism coverage in this sub-project (see I8 in the
// products-inventory final review): "toric-preorder-admin.spec.ts" and
// "toric-preorder-storefront.spec.ts" (now renamed preorder-admin.spec.ts /
// preorder-storefront.spec.ts) only ever exercised the generic `pre_order_enabled` flag on a
// plain sunglasses product, despite their old names implying toric coverage, and
// `AdminProductFormPage`'s `addToricEntry`/`getToricEntryCount` methods were dead code, unused by
// any spec.
//
// Uses "ACUVUE OASYS for Astigmatism (6 Pack)" — confirmed live to be the one product in this
// catalog with both "Contact Lens" and "Toric / Astigmatism" enabled and a real, non-empty
// sphere/cylinder/axis stock table (12 combinations, several carrying real stock/supplier
// numbers). This product's own category is confirmed live to already be empty
// (`category_ids: []`) independent of anything this spec does, so no category re-affirm defense
// is needed here — there is nothing to reaffirm, and this spec's own save() calls don't change
// that either way.
//
// Confirmed live: the admin products list's own search API (`/api/st/products?search=...`)
// returns zero results when searched on the product's full display name including its "(6 Pack)"
// suffix — the literal parentheses appear to break whatever matching the backend does
// server-side (a real, separate environment quirk, distinct from the category/toric-delete bugs
// documented in README.md). Searching on the name's non-parenthesized prefix instead works
// reliably and is still specific enough to be the only match in this catalog.
const PRODUCT_NAME = 'ACUVUE OASYS for Astigmatism';

test('adding a toric (sphere/cylinder/axis) stock combination persists after reload', async ({ adminPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit(PRODUCT_NAME);

  const form = new AdminProductFormPage(adminPage);
  await form.expectLoaded();
  const editUrl = adminPage.url();
  const productIdMatch = editUrl.match(/\/products\/([^/]+)\/edit/);
  if (!productIdMatch) throw new Error(`Could not extract product id from edit URL: ${editUrl}`);
  const productId = productIdMatch[1];

  // Confirmed live: reading the toric stock count back via a single reload right after save()
  // can still read a stale count (this app is served from Cloudflare Workers -- the same
  // edge-cache propagation lag README.md's "Known Environment Bugs" documents for the category
  // field's own read path applies here too). A single reload's result is fixed once rendered --
  // polling the already-rendered DOM can't fix a stale fetch -- so this retries a handful of
  // fresh reloads instead of just polling once.
  async function expectPersistedCount(expectedCount: number) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) {
        await adminPage.waitForTimeout(1000);
        await adminPage.reload();
        await form.expectLoaded();
        await expect(form.toricSwitch()).toHaveAttribute('aria-checked', 'true', { timeout: 15000 });
      }
      try {
        // Also covers the table-loads-later hydration race (see the readiness poll above): a
        // single immediate read right after a fresh reload can catch the table before its own
        // rows have populated, same as the very first `originalCount` read did.
        await expect.poll(() => form.getToricEntryCount(), { timeout: 8000 }).toBe(expectedCount);
        return;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
  }

  // Assert rather than force "Toric / Astigmatism" on: forcing it on for a product where it's
  // naturally off would be a much bigger, unrelated mutation than this test should make (and
  // this is the one product confirmed live to already have it on with real data underneath it).
  // This `expect` also doubles as a readiness gate for the section below, which only renders once
  // the product's own contact-lens/toric flags have loaded asynchronously -- confirmed live this
  // can take several seconds after `expectLoaded()`'s own Save-button check already passes
  // (a separate, later data fetch populates the Contact Lens/toric section), so this needs a
  // longer timeout than the default 5s assertion budget.
  await expect(form.toricSwitch()).toHaveAttribute('aria-checked', 'true', {
    timeout: 15000,
  });

  // The toric stock table's own 12 rows are confirmed live to load via a separate, later fetch
  // than the "Toric / Astigmatism" flag checked above -- reading the count immediately after
  // that flag settles can race ahead of the table actually populating (confirmed live: a bare
  // `getToricEntryCount()` here intermittently read back 0 instead of 12). Poll until the table
  // has settled on its real baseline before capturing it as `originalCount`.
  await expect.poll(() => form.getToricEntryCount(), { timeout: 15000 }).toBeGreaterThan(0);
  const originalCount = await form.getToricEntryCount();

  // Confirmed live not to already be one of this product's existing combinations, so adding it
  // is additive rather than colliding with (and silently overwriting the stock of) a real row --
  // the underlying API upserts on the (product, sphere, cylinder, axis) tuple.
  const entry = { sphere: '-4.00', cylinder: '-0.75', axis: '10', qty: 5 };
  await form.addToricEntry(entry);
  expect(await form.getToricEntryCount()).toBe(originalCount + 1);

  // `form.save()` only waits for the product PATCH response, not the separate toric-stock POST
  // that also fires on Save (confirmed live via network capture: PATCH .../st_products, DELETE
  // .../st_product_categories, POST .../api/le/product-toric-stock, POST
  // .../api/le/product-eyeglass-options, roughly concurrently) -- reloading right after `save()`
  // returns can abort that still-in-flight toric-stock request before it completes, the same
  // "navigate away too early" race this suite has hit before (e.g. admin-suppliers.page.ts's
  // createSupplier()). Wait for it explicitly here rather than teaching the generic save() about
  // a request only this one spec cares about.
  const toricStockSaveSettled = adminPage.waitForResponse(
    (response) => response.url().includes('/api/le/product-toric-stock') && response.request().method() === 'POST',
  );
  await form.save();
  await toricStockSaveSettled;
  await adminPage.reload();
  await form.expectLoaded();
  await expect(form.toricSwitch()).toHaveAttribute('aria-checked', 'true', {
    timeout: 15000,
  });
  await expectPersistedCount(originalCount + 1);

  // Restore: confirmed live (and via lensyadmin source — see README's "Known Environment Bugs")
  // that removing a row in this form's UI and clicking Save does NOT actually delete it
  // server-side — the form's Save only ever upserts the combinations still present locally, it
  // never calls the API's own per-entry DELETE route for one removed from the list. So cleanup
  // here calls that DELETE route directly (via `deleteToricEntryPermanently`) instead of the
  // (non-functional for this purpose) UI delete-row-then-Save flow.
  await form.deleteToricEntryPermanently(productId, entry);

  await adminPage.reload();
  await form.expectLoaded();
  await expect(form.toricSwitch()).toHaveAttribute('aria-checked', 'true', {
    timeout: 15000,
  });
  await expectPersistedCount(originalCount);
});
