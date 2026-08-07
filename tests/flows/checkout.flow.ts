import { Page } from '@playwright/test';
import { StorefrontRegionPage } from '../pages/storefront-region.page';
import { StorefrontCheckoutPage } from '../pages/storefront-checkout.page';
import { env } from '../support/env';

export async function placeOrder(page: Page): Promise<{ orderNumber: string }> {
  // customerPage starts blank (no storageState navigation) — load the storefront first
  // so the header (and its region-switcher button) actually exists to click.
  await page.goto(env.storefrontUrl());
  await new StorefrontRegionPage(page).switchToKuwait();

  // "Carrera CA8044/S" is a simple sunglasses product with no lens-power selection —
  // confirmed live to go straight to a plain "Add to Cart" button, unlike lens products
  // which open a power-selection modal. Using it keeps this flow free of that unrelated
  // complexity.
  await page.goto(new URL('en/product/carrera-ca8044s', env.storefrontUrl()).toString());
  await page.getByRole('button', { name: 'Add to Cart' }).click();

  await page.goto(new URL('en/checkout', env.storefrontUrl()).toString());
  const checkout = new StorefrontCheckoutPage(page);
  await checkout.fillAddress({
    firstName: 'QA',
    lastName: 'Tester',
    phone: '50123456',
    street: 'Test Street 1',
    city: 'Kuwait City',
    area: 'Hawally',
  });
  await checkout.selectFreeShipping();
  await checkout.selectCashOnDelivery();
  await checkout.placeOrder();

  const orderNumber = await checkout.expectOrderPlaced();
  return { orderNumber };
}
