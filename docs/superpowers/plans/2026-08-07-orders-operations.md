# Orders & Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automated coverage for the 3 delivered "Orders & Operations" features (QR-code invoice, print→auto-status, exhaustive invoice editing), built on Foundation's Playwright/TypeScript scaffolding, plus a reusable checkout flow other future suites can use to place real test orders.

**Architecture:** A `placeOrder()` flow drives the real storefront checkout as the logged-in customer (switch to Kuwait/KWD region, add a simple non-prescription product to cart, fill address, place order) and returns the order number. Admin-side Page Objects locate that order by searching its number, then exercise print/status/edit behavior. Every Orders & Operations test that needs a fresh order calls `placeOrder()` itself — no sharing.

**Tech Stack:** Playwright + TypeScript (from Foundation), `jsqr` (new) for decoding the invoice QR code.

## IMPORTANT — known live bug affecting this entire plan

While building this plan, live testing against the checkout found a real, reproducible bug in the test environment: **`POST /api/payment/methods` returns HTTP 500**, so the checkout's Payment Method section always shows "No payment methods available" and `placeOrder()` cannot currently complete past that point. Confirmed via two independent fresh page loads — not a transient blip.

Per explicit instruction, this plan does **not** wait for that bug to be fixed. Every task below is built and verified as if checkout worked; because it currently doesn't, most tasks' tests are **expected to fail right now**, at the payment-method step, with the same root cause every time. That is the correct, documented outcome — it's real information for the report ("checkout is broken") rather than a plan defect. Task 2 is deliberately structured to use an existing (read-only) order instead of `placeOrder()`, so at least one part of this suite is expected to pass today and prove the harness itself works.

**Verification rule for every task below:** "the test passes" means what it says. Where a task's test is expected to fail due to the known bug, its verification step says so explicitly — confirm it fails with *that specific* error (payment method unavailable / `Place Order & Pay` not completing), not a different error. A different failure means something in that task's own code is broken and must be fixed before moving on.

## Global Constraints

- Node.js 20+, Desktop Chrome only, TypeScript strict mode (from Foundation).
- All credentials/URLs via env vars (already wired in `tests/support/env.ts`) — never hardcoded, never committed.
- Every test that needs an order places its own fresh one via `placeOrder()` — no reuse across tests, no mutating the 57 seeded demo orders (except the read-only regression test in Task 2, which only reads an existing order, never mutates it).
- New unnamed/icon-only interactive elements discovered during this plan get logged to `docs/testid-requests.md`, same process as Foundation.
- Money amounts in this KWD storefront use 3 decimal places (e.g. `KWD 118.000`) — assertions on totals must match that format, not 2 decimals.

---

### Task 1: Checkout flow + place-order test

**Files:**
- Create: `tests/pages/storefront-region.page.ts`, `tests/pages/storefront-checkout.page.ts`, `tests/flows/checkout.flow.ts`, `tests/specs/orders-operations/checkout.spec.ts`
- Modify: `docs/testid-requests.md` (append 2 rows)

**Interfaces:**
- Consumes: `customerPage` fixture, `env` from Foundation.
- Produces: `placeOrder(page: Page): Promise<{ orderNumber: string }>` exported from `tests/flows/checkout.flow.ts` — the function every later task in this plan calls to get a fresh order. It throws if checkout doesn't complete (callers must expect that, given the known bug above).

- [ ] **Step 1: Create `tests/pages/storefront-region.page.ts`**

The storefront defaults to an "International" region with no working delivery method in this test env. This switches it to Kuwait (KWD), which has working delivery + address handling. Confirmed live: the header has a button showing the current region's currency code (initially "USD"); clicking it opens a "Select Your Location" panel with one button per country, each named after the country (e.g. "Kuwait").

```typescript
import { Page } from '@playwright/test';

export class StorefrontRegionPage {
  constructor(private page: Page) {}

  async switchToKuwait() {
    await this.page.locator('header').getByRole('button', { name: /USD|KWD/ }).click();
    await this.page.getByRole('button', { name: 'Kuwait' }).click();
  }
}
```

- [ ] **Step 2: Create `tests/pages/storefront-checkout.page.ts`**

Confirmed live (Kuwait/KWD mode): checkout form fields by placeholder text, a native `<select>` combobox named "Select area" for the governorate (confirmed options in this test env: "Assima", "Hawally", "Sabah Alsalem"), shipping method as radio buttons inside `<label>` elements (clicking the label toggles the radio), and a "Place Order & Pay" button. The Payment Method section is currently broken (see the known-bug note at the top of this plan) — this method still attempts to select "Cash on Delivery" based on existing orders showing "COD", since that's the best real evidence available; if the live bug is fixed before this runs, verify the actual label matches and adjust if not.

```typescript
import { Page, expect } from '@playwright/test';

export class StorefrontCheckoutPage {
  constructor(private page: Page) {}

  async fillAddress(details: {
    firstName: string;
    lastName: string;
    phone: string;
    street: string;
    city: string;
    area: 'Assima' | 'Hawally' | 'Sabah Alsalem';
  }) {
    await this.page.getByPlaceholder('First name *').fill(details.firstName);
    await this.page.getByPlaceholder('Last name *').fill(details.lastName);
    await this.page.getByPlaceholder('Phone number *').fill(details.phone);
    await this.page.getByPlaceholder('Street Address *').fill(details.street);
    await this.page.getByPlaceholder('City *').fill(details.city);
    await this.page.getByRole('combobox', { name: 'Select area' }).selectOption(details.area);
  }

  async selectFreeShipping() {
    await this.page.locator('label', { hasText: 'Free Shipping' }).click();
  }

  async selectCashOnDelivery() {
    await this.page.locator('label', { hasText: /cash on delivery|COD/i }).click();
  }

  async placeOrder() {
    await this.page.getByRole('button', { name: 'Place Order & Pay' }).click();
  }

  async expectOrderPlaced(): Promise<string> {
    // Confirmed live: order confirmation behavior after a successful placement was not
    // observable due to the known payment-methods bug. Investigate the real post-order
    // page/toast when writing this task (Playwright trace on the first real attempt will
    // show exactly what renders) and replace this with a concrete assertion + order
    // number extraction. Do not guess further than this comment — run it and look.
    throw new Error('expectOrderPlaced: implement against the real confirmation page once reachable');
  }
}
```

- [ ] **Step 3: Create `tests/flows/checkout.flow.ts`**

```typescript
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
```

- [ ] **Step 4: Create `tests/specs/orders-operations/checkout.spec.ts`**

```typescript
import { test } from '../../fixtures/roles.fixture';
import { placeOrder } from '../../flows/checkout.flow';

test('customer can complete checkout and place an order', async ({ customerPage }) => {
  const { orderNumber } = await placeOrder(customerPage);
  console.log('Placed order:', orderNumber);
});
```

- [ ] **Step 5: Run it and record the actual outcome**

Run: `npx playwright test checkout.spec`

Given the known bug, expected outcome right now: the test fails inside `placeOrder()`, specifically at the `expectOrderPlaced()` call (which deliberately throws until implemented against the real confirmation page — see Step 2). Before reaching that point, confirm every earlier step of the flow succeeds: region switch, add to cart, address fill, shipping selection. If `selectCashOnDelivery()` also fails to find a matching label (likely, since the Payment Method section renders empty per the known bug), that's consistent with the known bug too — note in the report/commit message exactly which step failed and why, so it's traceable to the payment-methods 500, not a new problem.

If, by the time this runs, the live bug has been fixed and payment methods actually load: implement `expectOrderPlaced()` for real (assert whatever the real confirmation page shows, extract the real order number format) and get this test fully green before moving to Task 2.

- [ ] **Step 6: Add the newly-discovered unnamed elements to the test-id ask-list**

Append two rows to `docs/testid-requests.md`'s table:

```markdown
| Storefront header | Region/currency toggle button (shows current currency code, e.g. "USD"/"KWD") | No stable accessible name beyond the currency code text, which changes | `getByRole('button', { name: /USD\|KWD/ })` scoped to `header` | `region-toggle-button` |
| Storefront checkout | Payment Method radio inputs | Labels depend on which payment methods the backend returns — currently broken (returns none), so no live-verified selector exists | `label:has-text("Cash on Delivery")` (best-effort, unverified) | `payment-method-cod` |
```

- [ ] **Step 7: Commit**

```bash
git add tests/pages/storefront-region.page.ts tests/pages/storefront-checkout.page.ts tests/flows/checkout.flow.ts tests/specs/orders-operations/checkout.spec.ts docs/testid-requests.md
git commit -m "feat: checkout flow for placing test orders (blocked on live payment-methods bug)"
```

---

### Task 2: Admin order Page Objects + read-only regression test

**Files:**
- Create: `tests/pages/admin-orders-list.page.ts`, `tests/pages/admin-order-detail.page.ts`, `tests/specs/orders-operations/order-detail-regression.spec.ts`

**Interfaces:**
- Consumes: `adminPage` fixture from Foundation.
- Produces: `AdminOrdersListPage.searchAndOpen(orderNumber: string): Promise<void>`, `AdminOrderDetailPage` with `printInvoice()`, `getCurrentStatus(): Promise<string>`, `getSubtotal()/getTotal(): Promise<string>` — the class every later task in this plan imports to interact with an order detail page.

- [ ] **Step 1: Create `tests/pages/admin-orders-list.page.ts`**

Confirmed live: the Orders list has a search box (placeholder "Search orders...") and each row has an unnamed action button that opens a menu containing a "Order Details" menu item.

```typescript
import { Page } from '@playwright/test';
import { env } from '../support/env';

export class AdminOrdersListPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(new URL('orders', env.adminUrl()).toString());
  }

  async searchAndOpen(orderNumber: string) {
    await this.page.getByPlaceholder('Search orders...').fill(orderNumber);
    const row = this.page.getByRole('row', { name: new RegExp(orderNumber) });
    await row.getByRole('button').last().click();
    await this.page.getByRole('menuitem', { name: 'Order Details' }).click();
  }
}
```

- [ ] **Step 2: Create `tests/pages/admin-order-detail.page.ts`**

Confirmed live: "Print Invoice" and "Copy ID" buttons, an "Order Summary" section with "Subtotal"/"Total" rows, and an "Update Status" section showing the current status text below a "Current Status" label. The exact control for *changing* status (dropdown vs. button+menu) was not interacted with yet — investigate it live when Task 3 needs to change status; this task only needs to *read* the current status, which is a plain text assertion.

```typescript
import { Page, expect } from '@playwright/test';

export class AdminOrderDetailPage {
  constructor(private page: Page) {}

  async printInvoice() {
    await this.page.getByRole('button', { name: 'Print Invoice' }).click();
  }

  async expectStatus(status: string) {
    // "Update Status" heading is followed by the current status value, then the
    // "Current Status" label underneath it (confirmed order: value text, then label).
    await expect(
      this.page.getByRole('heading', { name: 'Update Status' }).locator('xpath=..').getByText(status, { exact: true })
    ).toBeVisible();
  }

  async expectNoConsoleErrors(errors: string[]) {
    expect(errors, `Unexpected console errors on order detail page: ${errors.join('; ')}`).toEqual([]);
  }
}
```

- [ ] **Step 3: Create `tests/specs/orders-operations/order-detail-regression.spec.ts`**

Uses an existing seeded order (`#ORD-20260510-0001`, status "Delivered") — read-only, never mutated, so this test doesn't depend on `placeOrder()` and should pass regardless of the checkout bug. It also turns the `__name is not defined` console error found during brainstorming into permanent regression coverage.

```typescript
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
```

- [ ] **Step 4: Run it and verify it passes**

Run: `npx playwright test order-detail-regression`
Expected: PASS. This test does not depend on the known checkout bug — if it fails, something in this task's own Page Objects is wrong (fix before continuing), or the `__name is not defined` error is real and still present (in which case the test correctly fails and that failure is exactly the point — leave it failing and note it in the report; do not work around it by loosening the assertion).

- [ ] **Step 5: Commit**

```bash
git add tests/pages/admin-orders-list.page.ts tests/pages/admin-order-detail.page.ts tests/specs/orders-operations/order-detail-regression.spec.ts
git commit -m "feat: admin order Page Objects and read-only console-error regression test"
```

---

### Task 3: Print → status tests

**Files:**
- Create: `tests/specs/orders-operations/print-status.spec.ts`
- Modify: `tests/pages/admin-order-detail.page.ts` (add status-changing method)

**Interfaces:**
- Consumes: `placeOrder()` from Task 1, `AdminOrdersListPage`/`AdminOrderDetailPage` from Task 2.
- Produces: `AdminOrderDetailPage.setStatus(status: string): Promise<void>` for later tasks that need to change status.

- [ ] **Step 1: Add `setStatus` to `tests/pages/admin-order-detail.page.ts`**

The exact control for changing status was not confirmed live (see Task 2 Step 2). Write this against the real app when running this task — start from the "Update Status" heading found in Task 2 and inspect what's actually clickable near it (Playwright's codegen or a trace of a manual attempt will show it immediately). Below is the best-effort starting point, structured as a dropdown similar to the confirmed region-picker pattern (click to open, click the named option) — adjust based on what you actually find:

```typescript
async setStatus(status: string) {
  await this.page.getByRole('heading', { name: 'Update Status' }).locator('xpath=..').getByRole('button').click();
  await this.page.getByRole('option', { name: status }).click();
}
```

- [ ] **Step 2: Create `tests/specs/orders-operations/print-status.spec.ts`**

```typescript
import { test } from '../../fixtures/roles.fixture';
import { placeOrder } from '../../flows/checkout.flow';
import { AdminOrdersListPage } from '../../pages/admin-orders-list.page';
import { AdminOrderDetailPage } from '../../pages/admin-order-detail.page';

test('printing a fresh order sets its status to Preparing', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  await detail.printInvoice();
  await detail.expectStatus('Preparing');
});

test('printing an already-shipped order does not revert its status', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  await detail.setStatus('Shipped');
  await detail.printInvoice();
  await detail.expectStatus('Shipped');
});
```

- [ ] **Step 3: Run it and record the outcome**

Run: `npx playwright test print-status`
Expected right now: both tests fail inside `placeOrder()` (the known checkout bug — see the note at the top of this plan). Confirm the failure happens there, not inside the admin-side code, by checking the error/trace points at `checkout.flow.ts`. If it fails anywhere else, that's a real bug in this task's own code — fix it before moving on.

- [ ] **Step 4: Commit**

```bash
git add tests/pages/admin-order-detail.page.ts tests/specs/orders-operations/print-status.spec.ts
git commit -m "feat: print-to-status tests (blocked on live checkout bug, see plan note)"
```

---

### Task 4: QR code test

**Files:**
- Create: `tests/specs/orders-operations/qr-code.spec.ts`
- Modify: `package.json` (add `jsqr` dependency)

**Interfaces:**
- Consumes: `placeOrder()` from Task 1, `AdminOrdersListPage`/`AdminOrderDetailPage` from Task 2/3.

- [ ] **Step 1: Install `jsqr`**

```bash
npm install -D jsqr @types/jsqr
```

- [ ] **Step 2: Create `tests/specs/orders-operations/qr-code.spec.ts`**

The QR code is confirmed to render as a `data:image/png;base64,...` image as part of the print-invoice flow (confirmed via network capture during brainstorming — a `data:image` request fires when Print Invoice is clicked). The exact DOM location of that image, and what URL the QR encodes, were not confirmed live (print triggers `window.print()`, which needs `page.evaluate` interception in headless Playwright — untested in this sandbox's browser tool, but this is exactly what Playwright is good at: headless Chromium does not show a blocking OS print dialog the way a real desktop browser does). Write this test by first getting the raw pixel data decoded, logging the result, and iterating — do not guess the target URL's shape:

```typescript
import { test, expect } from '../../fixtures/roles.fixture';
import { placeOrder } from '../../flows/checkout.flow';
import { AdminOrdersListPage } from '../../pages/admin-orders-list.page';
import { AdminOrderDetailPage } from '../../pages/admin-order-detail.page';
import jsQR from 'jsqr';

test('printed invoice QR code links to a working page', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  await detail.printInvoice();

  // Investigate the real DOM here: find the QR <img> or <canvas>, get its pixel data.
  // For an <img src="data:image/png;base64,...">, decode the base64 PNG to raw RGBA
  // pixels (e.g. via the `pngjs` package, or by drawing it to an off-page <canvas> inside
  // page.evaluate and reading getImageData) before calling jsQR(data, width, height).
  // Log the decoded value first and assert on what it actually is — do not assume a URL
  // shape in advance.
  throw new Error('Implement QR extraction against the real print-invoice DOM — see comment above');
});
```

- [ ] **Step 3: Run it and record the outcome**

Run: `npx playwright test qr-code`
Expected right now: fails inside `placeOrder()` before ever reaching the QR logic, for the same known reason as Tasks 1 and 3. If checkout is still broken when this runs, replace the `throw` with the real implementation anyway (it can be written and reviewed for correctness even though it can't be exercised end-to-end yet) — but do not claim it passes if it can't actually run past the checkout step. Note this clearly in the task's completion report.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tests/specs/orders-operations/qr-code.spec.ts
git commit -m "feat: QR-code invoice test (blocked on live checkout bug, see plan note)"
```

---

### Task 5: Edit invoice — customer info + shipping address

**Files:**
- Create: `tests/specs/orders-operations/edit-customer-address.spec.ts`
- Modify: `tests/pages/admin-order-detail.page.ts` (add edit methods)

**Interfaces:**
- Consumes: `placeOrder()` from Task 1, `AdminOrderDetailPage` from Task 2/3.

- [ ] **Step 1: Add edit methods to `tests/pages/admin-order-detail.page.ts`**

The pencil/edit icon buttons next to "Customer Information" and "Shipping Address" are unnamed icon buttons (confirmed present live, but not clicked through to see the edit modal's field names). Investigate the real modal when writing this task — it's very likely to reuse the same field labels as the checkout form (First name, Last name, Phone number, Street Address, City, area). Starting point:

```typescript
async editCustomerInfo(details: { firstName: string; lastName: string }) {
  await this.page.getByRole('heading', { name: 'Customer Information' }).locator('xpath=..').getByRole('button').click();
  // Investigate the real modal fields here — likely similar to the checkout form's
  // "First name *"/"Last name *" placeholders. Fill and save, then close the modal.
  throw new Error('Implement against the real Customer Information edit modal');
}

async editShippingAddress(details: { street: string; city: string }) {
  await this.page.getByRole('heading', { name: 'Shipping Address' }).locator('xpath=..').getByRole('button').click();
  throw new Error('Implement against the real Shipping Address edit modal');
}
```

- [ ] **Step 2: Add the pencil buttons to the test-id ask-list**

Append to `docs/testid-requests.md`:

```markdown
| Admin order detail | Edit (pencil) button next to "Customer Information" | No accessible name, icon-only | `heading:has-text("Customer Information") + button` (positional) | `edit-customer-info-button` |
| Admin order detail | Edit (pencil) button next to "Shipping Address" | No accessible name, icon-only | `heading:has-text("Shipping Address") + button` (positional) | `edit-shipping-address-button` |
```

- [ ] **Step 3: Create `tests/specs/orders-operations/edit-customer-address.spec.ts`**

```typescript
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
```

- [ ] **Step 4: Run it and record the outcome**

Run: `npx playwright test edit-customer-address`
Expected right now: both fail inside `placeOrder()`, same known reason as prior tasks. Confirm that, not a different failure.

- [ ] **Step 5: Commit**

```bash
git add tests/pages/admin-order-detail.page.ts tests/specs/orders-operations/edit-customer-address.spec.ts docs/testid-requests.md
git commit -m "feat: edit customer info and shipping address tests (blocked on live checkout bug)"
```

---

### Task 6: Edit invoice — line items

**Files:**
- Create: `tests/specs/orders-operations/edit-line-items.spec.ts`
- Modify: `tests/pages/admin-order-detail.page.ts` (add item methods)

**Interfaces:**
- Consumes: `placeOrder()` from Task 1, `AdminOrderDetailPage` from Task 2/3/5.

- [ ] **Step 1: Add line-item methods to `tests/pages/admin-order-detail.page.ts`**

Confirmed live: "Add item" button, and each line item has its own "Edit"/"Delete" buttons. The add/edit item modal's fields were not opened — investigate live when writing this task.

```typescript
async addItem(/* fields TBD from the real modal */) {
  await this.page.getByRole('button', { name: 'Add item' }).click();
  throw new Error('Implement against the real Add Item modal');
}

async deleteItem(index: number) {
  await this.page.getByRole('button', { name: 'Delete' }).nth(index).click();
}

async getItemCount(): Promise<number> {
  return this.page.getByRole('button', { name: 'Delete' }).count();
}
```

- [ ] **Step 2: Create `tests/specs/orders-operations/edit-line-items.spec.ts`**

```typescript
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
```

- [ ] **Step 3: Run it and record the outcome**

Run: `npx playwright test edit-line-items`
Expected right now: fails inside `placeOrder()`, same known reason. Confirm that, not a different failure.

- [ ] **Step 4: Commit**

```bash
git add tests/pages/admin-order-detail.page.ts tests/specs/orders-operations/edit-line-items.spec.ts
git commit -m "feat: edit line-item tests (blocked on live checkout bug, see plan note)"
```

---

## Orders & Operations Done Criteria

- [ ] All 6 tasks' code committed, matching the file structure above.
- [ ] Task 2's regression test passes (proves the harness and admin Page Objects work independently of the checkout bug).
- [ ] Tasks 1, 3, 4, 5, 6 fail at the documented, known point (`placeOrder()`'s payment-method step) — confirmed via each task's verification step, not a different/new failure.
- [ ] `docs/testid-requests.md` updated with the region-toggle button, payment-method radios, and the two pencil-edit buttons.
- [ ] CI run pushed and its report checked — the report should visibly show the mixed pass/fail state described above. That mixed state, correctly explained, **is** the deliverable for this sub-project given the live bug.
- [ ] The known payment-methods bug reported back to the human partner in plain terms (what's broken, how it was confirmed, what it blocks) so they can relay it to the developer — this plan does not include reporting it anywhere outside the test suite itself.
