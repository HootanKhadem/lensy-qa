import { test, expect } from '@playwright/test';
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
  const productLabel = 'Carrera CA8044/S';
  const originalStock = await portal.getSupplierStock(productLabel);

  // Pick a value guaranteed to differ from the original, so the persistence assertion below is
  // meaningful even if the account happens to already show 40 (the previous hardcoded value).
  const testStock = originalStock === 40 ? 41 : 40;
  await portal.setSupplierStock(productLabel, testStock);

  await page.reload();
  expect(await portal.getSupplierStock(productLabel)).toBe(testStock);

  // Restore the original value, and verify the restore itself actually persisted rather than
  // relying on it implicitly — matching every other mutating spec in this sub-project. The
  // original version of this test (from the plan's own Task 6 snippet) set stock to 40 and
  // ended, asserting nothing about its own mutation and leaving the value changed for the next
  // run — see I4 in the products-inventory final review.
  await portal.setSupplierStock(productLabel, originalStock);
  await page.reload();
  expect(await portal.getSupplierStock(productLabel)).toBe(originalStock);
});
