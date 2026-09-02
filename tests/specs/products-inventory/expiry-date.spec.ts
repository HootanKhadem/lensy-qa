import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

// Uses "Santos" — reassigned off the originally-shared "Carrera CA8044/S" so this spec no longer
// races supplier-stock.spec.ts's own save() against the same product record under this suite's
// `fullyParallel` execution (see I5 in the products-inventory final review; "Carrera CA8044/S"
// also already lost its own category to the save-wipes-category bug from earlier tasks in this
// sub-project, before either fix existed). "Santos" is confirmed live to still have its own
// intact "Colored Contact Lenses" category, so this defends it with the same re-affirm-and-verify
// approach every products-inventory spec that saves a product now uses (see C1).
const PRODUCT_NAME = 'Santos';
const CATEGORY_NAME = 'Colored Contact Lenses';

test('setting a product expiry date persists after reload', async ({ adminPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit(PRODUCT_NAME);

  const form = new AdminProductFormPage(adminPage);
  const originalExpiry = await form.getExpiryDate();

  const testExpiry = '2027-06-15';
  await form.setExpiryDate(testExpiry);
  await form.saveReaffirmingCategory(CATEGORY_NAME);

  await adminPage.reload();
  await form.expectLoaded();
  expect(await form.getExpiryDate()).toBe(testExpiry);

  // Restore original value so other suites/products list views aren't left mutated.
  await form.setExpiryDate(originalExpiry);
  await form.saveReaffirmingCategory(CATEGORY_NAME);

  // Verify the restore itself actually persisted, rather than relying on it implicitly —
  // matching supplier-stock.spec.ts / preorder-admin.spec.ts's convention (see I6 in the final
  // review: this spec previously never verified its own restore).
  await adminPage.reload();
  await form.expectLoaded();
  expect(await form.getExpiryDate()).toBe(originalExpiry);
});
