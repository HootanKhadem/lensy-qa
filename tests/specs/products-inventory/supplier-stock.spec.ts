import { test, expect } from '../../fixtures/roles.fixture';
import { AdminSuppliersPage } from '../../pages/admin-suppliers.page';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

// Uses "Vitorio" — reassigned off the originally-shared "Carrera CA8044/S" so this spec no
// longer races expiry-date.spec.ts's own save() against the same product record under this
// suite's `fullyParallel` execution (see I5 in the products-inventory final review). "Vitorio" is
// confirmed live to still have its own intact "Sun Glasses" category and starts unlinked from any
// supplier ("No supplier"), so this defends its category the same way every products-inventory
// spec that saves a product now does (see C1).
const PRODUCT_NAME = 'Vitorio';
const CATEGORY_NAME = 'Sun Glasses';

test('supplier stock field and linked supplier persist on a product', async ({ adminPage }) => {
  const supplierName = `QA Test Supplier ${Date.now()}`;

  const suppliers = new AdminSuppliersPage(adminPage);
  await suppliers.goto();
  await suppliers.createSupplier(supplierName);
  await suppliers.expectSupplierListed(supplierName);

  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit(PRODUCT_NAME);

  const form = new AdminProductFormPage(adminPage);
  const originalSupplier = await form.getLinkedSupplier();
  const originalStock = await form.getSupplierStock();

  await form.setLinkedSupplier(supplierName);
  await form.setSupplierStock(25);
  await form.saveReaffirmingCategory(CATEGORY_NAME);

  await adminPage.reload();
  await form.expectLoaded();
  expect(await form.getLinkedSupplier()).toBe(supplierName);
  expect(await form.getSupplierStock()).toBe(25);

  // Restore the product's original supplier link/stock. Confirmed live: `getLinkedSupplier()`
  // returns the combobox's own "No supplier" placeholder text (a real, selectable option) when
  // nothing is linked — never an empty string — so calling `setLinkedSupplier(originalSupplier)`
  // unconditionally is always safe and correct, with no special-casing needed for "started with
  // nothing linked" (see I7 in the final review: the previous `if (originalSupplier)` guard here
  // was only ever live to skip a falsy empty string this combobox never actually produces, so it
  // silently never fired — relying on that by accident was fragile, and would have masked a real
  // gap for any product whose combobox ever did render as genuinely empty).
  await form.setLinkedSupplier(originalSupplier);
  await form.setSupplierStock(originalStock);
  await form.saveReaffirmingCategory(CATEGORY_NAME);

  // Verify the restore actually persisted, rather than relying on it implicitly.
  await adminPage.reload();
  await form.expectLoaded();
  expect(await form.getLinkedSupplier()).toBe(originalSupplier);
  expect(await form.getSupplierStock()).toBe(originalStock);
});
