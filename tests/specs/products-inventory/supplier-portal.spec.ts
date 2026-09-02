import { test } from '@playwright/test';
import { SupplierPortalPage } from '../../pages/supplier-portal.page';
import { env } from '../../support/env';

test('supplier can sign in and update their own stock for a linked product', async ({ page }) => {
  const portal = new SupplierPortalPage(page);
  await portal.goto();
  await portal.login(env.supplierEmail(), env.supplierPassword());
  await portal.expectSignedIn();

  // Assumes Task 3's "Carrera CA8044/S" ↔ QA Test Supplier link is still in place, or that
  // the supplied account is linked to at least one product with a visible stock row — adjust
  // the row label to whatever product this supplier account is actually linked to.
  await portal.setSupplierStock('Carrera CA8044/S', 40);
});
