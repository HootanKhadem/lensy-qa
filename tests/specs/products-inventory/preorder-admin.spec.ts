import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

// Renamed from "toric-preorder-admin.spec.ts" (see I8 in the products-inventory final review):
// this test exercises the generic `pre_order_enabled`/`pre_order_estimated_arrival` fields only
// — it never touched toric/astigmatism-specific fields despite the old name implying it did. Real
// toric/astigmatism coverage now lives in toric-stock-entry.spec.ts, against a product genuinely
// confirmed live to have "Toric / Astigmatism" enabled.
//
// Uses "Precision 30 pack" — reassigned off the originally-shared "Alcon Dailies Total1", which
// is confirmed live to have already lost its own category to the save-wipes-category bug (see
// C2/README's "Known Environment Bugs") before this task ever ran. "Precision 30 pack" is
// confirmed live to still have its own intact "Clear Contact Lenses" category.
const PRODUCT_NAME = 'Precision 30 pack';
const CATEGORY_NAME = 'Clear Contact Lenses';

test('enabling pre-order with an estimated arrival persists after reload', async ({ adminPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit(PRODUCT_NAME);

  const form = new AdminProductFormPage(adminPage);

  // "Estimated arrival" only renders once "Allow pre-order" is on, so capture the field's real
  // original value (not assume it's empty) by revealing it first, mirroring expiry-date.spec.ts
  // and supplier-stock.spec.ts's pattern of restoring the value actually found, not a guess.
  await form.setAllowPreOrder(true);
  const originalArrival = await form.getPreOrderEstimatedArrival();

  await form.setPreOrderEstimatedArrival('2 weeks');
  await form.saveReaffirmingCategory(CATEGORY_NAME);

  await adminPage.reload();
  await form.expectLoaded();
  await expect(adminPage.getByLabel('Allow pre-order')).toHaveAttribute('aria-checked', 'true');
  await expect(adminPage.getByLabel('Estimated arrival')).toHaveValue('2 weeks');

  // Restore: write back the captured original arrival value, then turn pre-order back off, so
  // the shared demo product isn't left mutated.
  await form.setPreOrderEstimatedArrival(originalArrival);
  await form.setAllowPreOrder(false);
  await form.saveReaffirmingCategory(CATEGORY_NAME);

  // Verify the restore itself actually persisted, rather than relying on it implicitly.
  await adminPage.reload();
  await form.expectLoaded();
  await expect(adminPage.getByLabel('Allow pre-order')).toHaveAttribute('aria-checked', 'false');
  // "Estimated arrival" is unmounted while pre-order is off, so re-enable it (without saving) to
  // read back the persisted value, confirming the restore wrote the original value rather than
  // leaving a stale one behind.
  await form.setAllowPreOrder(true);
  await expect(adminPage.getByLabel('Estimated arrival')).toHaveValue(originalArrival);
});
