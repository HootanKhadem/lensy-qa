import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

test('enabling pre-order with an estimated arrival persists after reload', async ({ adminPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Alcon Dailies Total1');

  const form = new AdminProductFormPage(adminPage);

  // "Estimated arrival" only renders once "Allow pre-order" is on, so capture the field's real
  // original value (not assume it's empty) by revealing it first, mirroring expiry-date.spec.ts
  // and supplier-stock.spec.ts's pattern of restoring the value actually found, not a guess.
  await form.setAllowPreOrder(true);
  const originalArrival = await form.getPreOrderEstimatedArrival();

  await form.setPreOrderEstimatedArrival('2 weeks');
  await form.save();

  await adminPage.reload();
  await form.expectLoaded();
  await expect(adminPage.getByLabel('Allow pre-order')).toHaveAttribute('aria-checked', 'true');
  await expect(adminPage.getByLabel('Estimated arrival')).toHaveValue('2 weeks');

  // Restore: write back the captured original arrival value, then turn pre-order back off, so
  // the shared demo product isn't left mutated (Foundation's storefront smoke test references it).
  await form.setPreOrderEstimatedArrival(originalArrival);
  await form.setAllowPreOrder(false);
  await form.save();

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
