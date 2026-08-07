import { test } from '../../fixtures/roles.fixture';
import { placeOrder } from '../../flows/checkout.flow';
import { AdminOrdersListPage } from '../../pages/admin-orders-list.page';
import { AdminOrderDetailPage } from '../../pages/admin-order-detail.page';

test('editing customer info persists after reload', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  // Exercises all three editable fields the "Edit customer" dialog confirmed live (Name, Email,
  // Phone) -- previously only Name was ever exercised by a test, even though Email/Phone were
  // found to be plain editable inputs during investigation (see editCustomerInfo()'s comments).
  await detail.editCustomerInfo({
    firstName: 'Updated',
    lastName: 'Name',
    email: 'updated-customer@example.com',
    phone: '+96599999999',
  });

  await adminPage.reload();
  await detail.expectCustomerName('Updated Name');
  await detail.expectCustomerEmail('updated-customer@example.com');
  await detail.expectCustomerPhone('+96599999999');
});

test('editing shipping address persists after reload', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  await detail.editShippingAddress({ street: 'Updated Street 99', city: 'Updated City' });

  await adminPage.reload();
  await detail.expectShippingStreet('Updated Street 99');
});
