import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

test('setting a product expiry date persists after reload', async ({ adminPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Carrera CA8044/S');

  const form = new AdminProductFormPage(adminPage);
  const originalExpiry = await form.getExpiryDate();

  const testExpiry = '2027-06-15';
  await form.setExpiryDate(testExpiry);
  await form.save();

  await adminPage.reload();
  await form.expectLoaded();
  expect(await form.getExpiryDate()).toBe(testExpiry);

  // Restore original value so other suites/products list views aren't left mutated.
  await form.setExpiryDate(originalExpiry);
  await form.save();
});
