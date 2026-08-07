import { test, expect } from '../../fixtures/roles.fixture';
import { placeOrder } from '../../flows/checkout.flow';
import { AdminOrdersListPage } from '../../pages/admin-orders-list.page';
import { AdminOrderDetailPage } from '../../pages/admin-order-detail.page';

test('editing customer info persists after reload', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  await detail.editCustomerInfo({ firstName: 'Updated', lastName: 'Name' });

  await adminPage.reload();
  await expect(adminPage.getByText('Updated Name')).toBeVisible();
});

test('editing shipping address persists after reload', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  await detail.editShippingAddress({ street: 'Updated Street 99', city: 'Updated City' });

  await adminPage.reload();
  await expect(adminPage.getByText('Updated Street 99')).toBeVisible();
});
