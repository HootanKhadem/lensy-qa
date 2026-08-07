import { test, expect } from '../../fixtures/roles.fixture';
import { AdminOrdersListPage } from '../../pages/admin-orders-list.page';
import { AdminOrderDetailPage } from '../../pages/admin-order-detail.page';

test('order detail page loads an existing order with no console errors', async ({ adminPage }) => {
  const errors: string[] = [];
  adminPage.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen('ORD-20260510-0001');

  const detail = new AdminOrderDetailPage(adminPage);
  await detail.expectStatus('Delivered');
  await detail.expectNoConsoleErrors(errors);
});
