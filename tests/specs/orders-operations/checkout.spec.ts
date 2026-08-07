import { test } from '../../fixtures/roles.fixture';
import { placeOrder } from '../../flows/checkout.flow';

test('customer can complete checkout and place an order', async ({ customerPage }) => {
  const { orderNumber } = await placeOrder(customerPage);
  console.log('Placed order:', orderNumber);
});
