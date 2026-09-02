import { test, expect } from '../../fixtures/roles.fixture';
import { AdminSuppliersPage } from '../../pages/admin-suppliers.page';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

test('supplier stock field and linked supplier persist on a product', async ({ adminPage }) => {
  const supplierName = `QA Test Supplier ${Date.now()}`;

  const suppliers = new AdminSuppliersPage(adminPage);
  await suppliers.goto();
  await suppliers.createSupplier(supplierName);
  await suppliers.expectSupplierListed(supplierName);

  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Carrera CA8044/S');

  const form = new AdminProductFormPage(adminPage);
  const originalSupplier = await form.getLinkedSupplier();
  const originalStock = await form.getSupplierStock();

  await form.setLinkedSupplier(supplierName);
  await form.setSupplierStock(25);
  await form.save();

  await adminPage.reload();
  await form.expectLoaded();
  expect(await form.getLinkedSupplier()).toBe(supplierName);
  expect(await form.getSupplierStock()).toBe(25);

  // Restore the product's original supplier link/stock.
  if (originalSupplier) {
    await form.setLinkedSupplier(originalSupplier);
  }
  await form.setSupplierStock(originalStock);
  await form.save();
});
