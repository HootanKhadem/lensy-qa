import { test, expect } from '@playwright/test';
import { SupplierPortalPage } from '../../pages/supplier-portal.page';
import { env } from '../../support/env';

test('supplier can sign in and update their own stock for a linked product', async ({ page }) => {
  const portal = new SupplierPortalPage(page);
  await portal.goto();
  await portal.login(env.supplierEmail(), env.supplierPassword());
  await portal.expectSignedIn();

  // No fixed product↔supplier link exists in this suite to assume: Task 3's supplier-stock.spec.ts
  // creates a freshly timestamped supplier account each run (never SUPPLIER_EMAIL) and, as of the
  // products-inventory final review's I5 fix, links it to "Vitorio" rather than the originally
  // shared "Carrera CA8044/S". Whichever real account SUPPLIER_EMAIL/SUPPLIER_PASSWORD point to
  // will have its own, unrelated set of linked products — 'Vitorio' below is only a reasonable
  // starting guess. Once real credentials are supplied, check the admin Suppliers page (or this
  // account's own product list once signed in) for what it's actually linked to, and adjust.
  const productLabel = 'Vitorio';
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
