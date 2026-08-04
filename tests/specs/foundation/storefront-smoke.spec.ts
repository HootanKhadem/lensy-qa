import { test } from '../../fixtures/roles.fixture';
import { StorefrontProductPage } from '../../pages/storefront-product.page';

test('signed-in customer can view a product page', async ({ customerPage }) => {
  const product = new StorefrontProductPage(customerPage);
  await product.goto('alcon-dailies-total1');
  await product.expectProductName('Alcon Dailies Total1');
});
