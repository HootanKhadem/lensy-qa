import { test, expect } from '../../fixtures/roles.fixture';
import { placeOrder } from '../../flows/checkout.flow';
import { AdminOrdersListPage } from '../../pages/admin-orders-list.page';
import { AdminOrderDetailPage } from '../../pages/admin-order-detail.page';

// Both getSubtotal()/getTotal() return the live-confirmed "KWD 62.000"-style string (a
// non-breaking space between the currency code and the amount) -- parsing out just the numeric
// part keeps these assertions about recalculation, not about exact string formatting.
function parseKwd(value: string): number {
  const match = value.match(/[\d.]+/);
  if (!match) {
    throw new Error(`Could not parse a KWD amount out of "${value}"`);
  }
  return parseFloat(match[0]);
}

test('deleting a line item recalculates totals and item count', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  // placeOrder() adds exactly one line item, so deleting it immediately would empty the order
  // entirely. Real order-management apps commonly guard against that (a disabled Delete on the
  // last remaining item, or a confirm dialog) -- which would make this test fail for app-policy
  // reasons unrelated to the recalculation behavior it's actually meant to cover. Adding a second
  // item first (exercising addItem(), which previously had no test coverage at all) keeps this
  // test squarely testing deletion + recalculation instead of an edge case it was never meant to
  // probe.
  await detail.addItem({ productName: 'Siren Bronz', quantity: 1, unitPrice: 6 });

  const beforeCount = await detail.getItemCount();
  const beforeSubtotal = parseKwd(await detail.getSubtotal());
  const beforeTotal = parseKwd(await detail.getTotal());

  await detail.deleteItem(0);

  const afterCount = await detail.getItemCount();
  const afterSubtotal = parseKwd(await detail.getSubtotal());
  const afterTotal = parseKwd(await detail.getTotal());

  expect(afterCount).toBe(beforeCount - 1);
  expect(afterSubtotal).toBeLessThan(beforeSubtotal);
  expect(afterTotal).toBeLessThan(beforeTotal);
});

test('adding a line item increases item count and totals', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  const beforeCount = await detail.getItemCount();
  const beforeSubtotal = parseKwd(await detail.getSubtotal());
  const beforeTotal = parseKwd(await detail.getTotal());

  // "Siren Bronz" (KWD 6.000) is a real, live-confirmed searchable product in the admin "Add
  // item" dialog (see addItem()'s own comments) -- using a live-confirmed product/price here
  // instead of a guessed one keeps the expected-delta assertion below meaningful.
  await detail.addItem({ productName: 'Siren Bronz', quantity: 2, unitPrice: 6 });

  const afterCount = await detail.getItemCount();
  const afterSubtotal = parseKwd(await detail.getSubtotal());
  const afterTotal = parseKwd(await detail.getTotal());

  expect(afterCount).toBe(beforeCount + 1);
  expect(afterSubtotal - beforeSubtotal).toBeCloseTo(2 * 6, 2);
  expect(afterTotal - beforeTotal).toBeCloseTo(2 * 6, 2);
});

test('editing a line item quantity recalculates totals', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  const beforeCount = await detail.getItemCount();
  const beforeSubtotal = parseKwd(await detail.getSubtotal());
  const beforeTotal = parseKwd(await detail.getTotal());

  // placeOrder() always adds exactly 1 unit of its product (see checkout.flow.ts), so bumping
  // the quantity to 3 here is guaranteed to be a real change regardless of which product/price
  // a given run's fresh order ends up with -- no power/SPH/CYL/AXIS editing UI exists for this
  // inline editor (confirmed live; see editItem()'s own comments), so quantity is what's
  // actually exercisable here.
  await detail.editItem(0, { quantity: 3 });

  const afterCount = await detail.getItemCount();
  const afterSubtotal = parseKwd(await detail.getSubtotal());
  const afterTotal = parseKwd(await detail.getTotal());

  // Editing an existing item's quantity changes its line total but not the item count.
  expect(afterCount).toBe(beforeCount);
  expect(afterSubtotal).toBeGreaterThan(beforeSubtotal);
  expect(afterTotal).toBeGreaterThan(beforeTotal);
});
