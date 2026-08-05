import { test, expect } from '../../fixtures/roles.fixture';
import { StorefrontProductPage } from '../../pages/storefront-product.page';

test('signed-in customer can view a product page', async ({ customerPage }) => {
  const product = new StorefrontProductPage(customerPage);
  await product.goto('alcon-dailies-total1');
  await product.expectProductName('Alcon Dailies Total1');
  // An anonymous visitor would also see the product heading above; assert the customer
  // session is actually active by checking the signed-out "Sign in" button is gone.
  await expect(customerPage.getByRole('button', { name: 'Sign in', exact: true })).not.toBeVisible();
});
