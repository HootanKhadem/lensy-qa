import { test, expect } from '@playwright/test';
import { SupplierPortalPage } from '../../pages/supplier-portal.page';
import { env } from '../../support/env';

test('supplier can sign in and update their own stock for a linked product', async ({ page }) => {
  const portal = new SupplierPortalPage(page);
  await portal.goto();
  await portal.login(env.supplierEmail(), env.supplierPassword());
  await portal.expectSignedIn();

  // The supplied SUPPLIER_EMAIL account is linked to the "Test supplier" record, whose products
  // are: Carrera CA295, Santos, ACUVUE OASYS for Astigmatism (6 Pack), Ash brown, and
  // RBJ 1900 3837 45. "Vitorio" (the previous placeholder) is not among them, and could not be
  // — supplier-stock.spec.ts takes Vitorio over on every run, relinking it to a freshly
  // timestamped supplier and restoring it afterwards, so under this config's fullyParallel
  // execution the two specs would race and Vitorio would intermittently be absent from this
  // account's list. "Ash brown" is used instead because no other spec in this suite touches it
  // (Santos belongs to expiry-date.spec.ts).
  const productLabel = 'Ash brown';
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
