import { test, expect } from '../../fixtures/roles.fixture';
import { placeOrder } from '../../flows/checkout.flow';
import { AdminOrdersListPage } from '../../pages/admin-orders-list.page';
import { AdminOrderDetailPage } from '../../pages/admin-order-detail.page';

test('deleting a line item recalculates totals and item count', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  const before = await detail.getItemCount();
  await detail.deleteItem(0);
  const after = await detail.getItemCount();

  expect(after).toBe(before - 1);
});
