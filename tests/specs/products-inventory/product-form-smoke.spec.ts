import { test } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

test('product edit form loads for an existing product', async ({ adminPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Carrera CA8044/S');

  const form = new AdminProductFormPage(adminPage);
  await form.expectLoaded();
});
