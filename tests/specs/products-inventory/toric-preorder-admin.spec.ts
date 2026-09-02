import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

test('enabling pre-order with an estimated arrival persists after reload', async ({ adminPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Alcon Dailies Total1');

  const form = new AdminProductFormPage(adminPage);
  await form.setAllowPreOrder(true);
  await form.setPreOrderEstimatedArrival('2 weeks');
  await form.save();

  await adminPage.reload();
  await form.expectLoaded();
  await expect(adminPage.getByLabel('Allow pre-order')).toHaveAttribute('aria-checked', 'true');
  await expect(adminPage.getByLabel('Estimated arrival')).toHaveValue('2 weeks');

  // Restore: turn pre-order back off so the shared demo product isn't left mutated.
  await form.setAllowPreOrder(false);
  await form.save();
});
