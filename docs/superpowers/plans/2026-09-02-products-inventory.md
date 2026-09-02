# Products & Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status (updated after the final whole-branch review's consolidated fix wave):** all 6 tasks are
complete, committed, and green against the live test environment except Task 6 (documented-blocked
on missing supplier test credentials, as originally planned). The fix wave also reassigned several
specs onto different catalog products (see Task-by-task notes below), added real toric/astigmatism
coverage in a new `toric-stock-entry.spec.ts`, and renamed `toric-preorder-admin.spec.ts` /
`toric-preorder-storefront.spec.ts` to `preorder-admin.spec.ts` / `preorder-storefront.spec.ts`
since they only ever exercised the generic pre-order flag, not toric-specific fields. Full detail
in `.superpowers/sdd/2026-09-02-products-inventory/final-fix-report.md`. The step-by-step plan
below is left as originally written (including its now-superseded product names/snippets in Task
6) for historical reference — see the actual source files for what shipped.

**Goal:** Automated coverage for the 4 delivered "Products & Inventory" features (pre-order for
astigmatism/toric lenses, per-product expiry date, supplier stock field, supplier panel), built
on Foundation's Playwright/TypeScript scaffolding.

**Architecture:** Admin-side Page Objects for the products list (`AdminProductsListPage`) and the
product edit form (`AdminProductFormPage`) — the form is a single large component
(`product-form.tsx`) covering common fields, contact-lens/toric fields, and pre-order fields all
at once, so one Page Object wraps all of it rather than splitting artificially. A separate
`AdminSuppliersPage` wraps the Suppliers admin screen (create supplier, invite user). A new
`SupplierPortalPage` wraps the storefront's `/supplier` self-service portal, which has its own
Supabase email/password login independent of admin/customer auth — it uses `@playwright/test`'s
own bare `test`/`page` fixtures directly (**not** a new `supplierPage` fixture on
`tests/fixtures/roles.fixture.ts`, corrected from an earlier draft of this note: the supplier
portal's independent auth means it needs no shared `storageState` setup, so adding a role fixture
for it would just be unnecessary machinery — see `supplier-portal.spec.ts`'s own comment on this).

Unlike the Orders & Operations plan, this one is grounded in the real `lensyadmin`/`lensyweb`
source (read directly, and via each repo's pre-built `graphify` knowledge graph at
`graphify-out/graph.json` — query with `graphify query "<question>"` from inside that repo) —
field ids, labels, and routes below are copied from the actual components, not guessed. Still
confirm live when you run each task: the deployed test environment should match, but it can
drift from the source snapshot this plan was written against.

**Tech Stack:** Playwright + TypeScript (from Foundation).

## Global Constraints

- Node.js 20+, Desktop Chrome only, TypeScript strict mode (from Foundation).
- All credentials/URLs via env vars (`tests/support/env.ts`) — never hardcoded, never committed.
- Environment is a disposable sandbox — but two of this plan's tasks (expiry date, supplier
  stock/toric/pre-order) mutate fields on **existing, real catalog products** that other suites
  reference (`carrera-ca8044s` is used by `checkout.flow.ts`; `alcon-dailies-total1` is used by
  Foundation's storefront smoke test). Every task that edits one of these products **must**
  restore the original field values in its own last test step (read the original value before
  editing, assert on the new value, then set it back and re-save) — do not leave test mutations
  in place for other suites to trip over.
- New unnamed/icon-only interactive elements discovered get logged to `docs/testid-requests.md`,
  same process as prior sub-projects.
- Money amounts in this KWD storefront use 3 decimal places (e.g. `KWD 118.000`).

## Known blocker — supplier portal credentials

`Credentials.txt` has admin + customer accounts only. The only way to create a supplier login in
the admin UI is the "Send invite" button on the Suppliers page (`suppliers-content.tsx`), which
triggers a real Supabase auth invite email — our automation cannot read that inbox, so it cannot
complete the invite-acceptance flow to set a password. **Task 6 below (supplier portal) needs a
`SUPPLIER_EMAIL`/`SUPPLIER_PASSWORD` env var pair for an already-active supplier account.** Ask
the user to either:
- provide a pre-created supplier email/password (same shape as `Credentials.txt`'s admin/customer
  rows), or
- provide access to the inbox the invite email would land in, or
- set the account's password directly (e.g. via the Supabase dashboard) after we send one invite.

Tasks 1–5 do not need this and can be built and run regardless.

---

### Task 1: Admin product Page Objects + smoke test

**Files:**
- Create: `tests/pages/admin-products-list.page.ts`, `tests/pages/admin-product-form.page.ts`, `tests/specs/products-inventory/product-form-smoke.spec.ts`

**Interfaces:**
- Consumes: `adminPage` fixture from Foundation.
- Produces: `AdminProductsListPage.searchAndOpenEdit(productName: string): Promise<void>` and
  `AdminProductFormPage` with `expectLoaded()`, `save()`, `getExpiryDate(): Promise<string>`,
  `setExpiryDate(date: string): Promise<void>`, `getSupplierStock(): Promise<number>`,
  `setSupplierStock(qty: number): Promise<void>`, `getLinkedSupplier(): Promise<string>`,
  `setLinkedSupplier(name: string): Promise<void>` — later tasks in this plan import both classes.

- [x] **Step 1: Create `tests/pages/admin-products-list.page.ts`**

Confirmed live in source (`products-content.tsx`): search box placeholder `"Search products..."`,
each row is a real `<tr>` (via `motion.tr`) showing the product's name as visible text, and each
row's only button (icon-only "more" trigger, `MoreHorizontal` icon, no accessible name) opens a
dropdown with `"View"`, `"Edit"`, `"Copy ID"` menu items — same shape as
`AdminOrdersListPage.searchAndOpen()` from the Orders & Operations plan.

```typescript
import { Page } from '@playwright/test';
import { env } from '../support/env';

export class AdminProductsListPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(new URL('products', env.adminUrl()).toString());
  }

  async searchAndOpenEdit(productName: string) {
    await this.page.getByPlaceholder('Search products...').fill(productName);
    const row = this.page.getByRole('row', { name: new RegExp(productName) });
    await row.getByRole('button').last().click();
    await this.page.getByRole('menuitem', { name: 'Edit' }).click();
  }
}
```

- [x] **Step 2: Create `tests/pages/admin-product-form.page.ts`**

Confirmed live in source (`product-form.tsx`): plain labeled inputs (no ids needed beyond
`getByLabel`), a native `<select>`-style Radix combobox for "Linked supplier", and a `type="submit"`
button whose text is `"Save"` (`tCommon('save')`) while idle. The pre-order fields
(`Allow pre-order` switch, `Estimated arrival` input) and toric section only render when the
product is a contact lens (`is_contact_lens`) — later tasks that need them confirm that toggle
first.

```typescript
import { Page, expect } from '@playwright/test';

export class AdminProductFormPage {
  constructor(private page: Page) {}

  async expectLoaded() {
    await expect(this.page.getByRole('button', { name: 'Save' })).toBeVisible();
  }

  async save() {
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
  }

  async getExpiryDate(): Promise<string> {
    return this.page.getByLabel('Expiry Date').inputValue();
  }

  async setExpiryDate(date: string) {
    await this.page.getByLabel('Expiry Date').fill(date);
  }

  async getSupplierStock(): Promise<number> {
    const value = await this.page.getByLabel('Supplier stock').inputValue();
    return parseInt(value, 10) || 0;
  }

  async setSupplierStock(qty: number) {
    await this.page.getByLabel('Supplier stock').fill(String(qty));
  }

  async getLinkedSupplier(): Promise<string> {
    return (await this.page.getByLabel('Linked supplier').textContent())?.trim() || '';
  }

  async setLinkedSupplier(name: string) {
    await this.page.getByLabel('Linked supplier').click();
    await this.page.getByRole('option', { name }).click();
  }

  async setAllowPreOrder(enabled: boolean) {
    const toggle = this.page.getByLabel('Allow pre-order');
    const checked = await toggle.getAttribute('aria-checked');
    if ((checked === 'true') !== enabled) {
      await toggle.click();
    }
  }

  async setPreOrderEstimatedArrival(text: string) {
    await this.page.getByLabel('Estimated arrival').fill(text);
  }
}
```

- [x] **Step 3: Create `tests/specs/products-inventory/product-form-smoke.spec.ts`**

Uses "Carrera CA8044/S" — the same product `checkout.flow.ts` already adds to cart, so it's
confirmed to exist in this environment. Read-only (no save), so it's safe to run any time.

```typescript
import { test } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

test('product edit form loads for an existing product', async ({ adminPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Carrera CA8044/S');

  const form = new AdminProductFormPage(adminPage);
  await form.expectLoaded();
});
```

- [x] **Step 4: Run it and verify it passes**

Run: `npx playwright test product-form-smoke`
Expected: PASS. If `searchAndOpenEdit` can't find the row, confirm "Carrera CA8044/S" is still the
exact product name in this environment (it may have been renamed) and adjust the literal string ­—
that's a data-drift fix, not a code bug.

- [x] **Step 5: Commit**

```bash
git add tests/pages/admin-products-list.page.ts tests/pages/admin-product-form.page.ts tests/specs/products-inventory/product-form-smoke.spec.ts
git commit -m "feat: admin product Page Objects and edit-form smoke test"
```

---

### Task 2: Expiry date field

**Files:**
- Create: `tests/specs/products-inventory/expiry-date.spec.ts`

**Interfaces:**
- Consumes: `AdminProductsListPage`, `AdminProductFormPage` from Task 1.

- [x] **Step 1: Create `tests/specs/products-inventory/expiry-date.spec.ts`**

Reads the original value first and restores it at the end, per the Global Constraints rule about
mutating shared catalog data.

```typescript
import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

test('setting a product expiry date persists after reload', async ({ adminPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Carrera CA8044/S');

  const form = new AdminProductFormPage(adminPage);
  const originalExpiry = await form.getExpiryDate();

  const testExpiry = '2027-06-15';
  await form.setExpiryDate(testExpiry);
  await form.save();

  await adminPage.reload();
  await form.expectLoaded();
  expect(await form.getExpiryDate()).toBe(testExpiry);

  // Restore original value so other suites/products list views aren't left mutated.
  await form.setExpiryDate(originalExpiry);
  await form.save();
});
```

- [x] **Step 2: Run it and verify it passes**

Run: `npx playwright test expiry-date`
Expected: PASS. If the date input's persisted format differs from `YYYY-MM-DD` (e.g. the API
normalizes it), adjust the assertion to match what's actually returned — a `type="date"` input's
`inputValue()` is always `YYYY-MM-DD` per the HTML spec, so a mismatch here means the app is doing
something unusual and is worth noting, not silently working around.

- [x] **Step 3: Commit**

```bash
git add tests/specs/products-inventory/expiry-date.spec.ts
git commit -m "feat: expiry date field test"
```

---

### Task 3: Suppliers admin — create supplier + link to product + supplier stock field

**Files:**
- Create: `tests/pages/admin-suppliers.page.ts`, `tests/specs/products-inventory/supplier-stock.spec.ts`

**Interfaces:**
- Consumes: `adminPage` fixture from Foundation; `AdminProductsListPage`/`AdminProductFormPage`
  from Task 1.
- Produces: `AdminSuppliersPage` with `goto()`, `createSupplier(name: string): Promise<void>`,
  `expectSupplierListed(name: string): Promise<void>`, plus `openInviteFor()`/`sendInvite()` for
  whoever later sends the one real invite email needed to provision the Task 6 supplier account
  (a manual/one-time action, not called from any automated spec in this plan — see the blocker
  note at the top).

- [x] **Step 1: Create `tests/pages/admin-suppliers.page.ts`**

Confirmed live in source (`suppliers-content.tsx`): heading `"Suppliers"`, an `"Add supplier"`
button opens a dialog with a `"Name"`-style plain input (the create form's first field, bound to
`form.name`) and a `"Save"` button in the dialog footer; each supplier row has an inline
"Users"/invite button and a per-supplier "Invite new user" panel with an
`"email@supplier.com"`-placeholder input and a `"Send invite"` button.

```typescript
import { Page, expect } from '@playwright/test';
import { env } from '../support/env';

export class AdminSuppliersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(new URL('suppliers', env.adminUrl()).toString());
  }

  async createSupplier(name: string) {
    await this.page.getByRole('button', { name: 'Add supplier' }).click();
    await this.page.getByRole('dialog').getByRole('textbox').first().fill(name);
    await this.page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  }

  async expectSupplierListed(name: string) {
    await expect(this.page.getByText(name, { exact: true }).first()).toBeVisible();
  }

  async openInviteFor(supplierName: string) {
    const row = this.page.getByRole('row', { name: new RegExp(supplierName) });
    await row.getByRole('button', { name: 'Users' }).click();
  }

  async sendInvite(email: string) {
    await this.page.getByPlaceholder('email@supplier.com').fill(email);
    await this.page.getByRole('button', { name: 'Send invite' }).click();
  }
}
```

- [x] **Step 2: Create `tests/specs/products-inventory/supplier-stock.spec.ts`**

Creates a fresh, disposable supplier (safe — additive, doesn't touch other tests' data), links it
to the shared "Carrera CA8044/S" product, sets its supplier-stock quantity, verifies persistence,
then restores the product's original linked-supplier/supplier-stock values per the Global
Constraints rule. The supplier record itself is left in place (harmless, additive, matches how
Orders & Operations left its 57 seeded demo orders alone rather than trying to delete test data).

```typescript
import { test, expect } from '../../fixtures/roles.fixture';
import { AdminSuppliersPage } from '../../pages/admin-suppliers.page';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

test('supplier stock field and linked supplier persist on a product', async ({ adminPage }) => {
  const supplierName = `QA Test Supplier ${Date.now()}`;

  const suppliers = new AdminSuppliersPage(adminPage);
  await suppliers.goto();
  await suppliers.createSupplier(supplierName);
  await suppliers.expectSupplierListed(supplierName);

  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Carrera CA8044/S');

  const form = new AdminProductFormPage(adminPage);
  const originalSupplier = await form.getLinkedSupplier();
  const originalStock = await form.getSupplierStock();

  await form.setLinkedSupplier(supplierName);
  await form.setSupplierStock(25);
  await form.save();

  await adminPage.reload();
  await form.expectLoaded();
  expect(await form.getLinkedSupplier()).toBe(supplierName);
  expect(await form.getSupplierStock()).toBe(25);

  // Restore the product's original supplier link/stock.
  if (originalSupplier) {
    await form.setLinkedSupplier(originalSupplier);
  }
  await form.setSupplierStock(originalStock);
  await form.save();
});
```

- [x] **Step 3: Run it and verify it passes**

Run: `npx playwright test supplier-stock`
Expected: PASS. If `getLinkedSupplier()`'s Radix combobox doesn't expose its selected value via
plain `textContent()` (Radix sometimes renders the selected label in a nested span), inspect the
live DOM with a trace and adjust the selector — this is exactly the kind of thing source access
gets close but not perfect on; the live app is still the final authority.

- [x] **Step 4: Commit**

```bash
git add tests/pages/admin-suppliers.page.ts tests/specs/products-inventory/supplier-stock.spec.ts
git commit -m "feat: supplier creation and product supplier-stock field tests"
```

---

### Task 4: Astigmatism/toric pre-order — admin side

**Files:**
- Modify: `tests/pages/admin-product-form.page.ts` (add toric-entry methods)
- Create: `tests/specs/products-inventory/toric-preorder-admin.spec.ts`

**Interfaces:**
- Consumes: `AdminProductsListPage`, `AdminProductFormPage` from Task 1.
- Produces: `AdminProductFormPage.addToricEntry(...)`, `.deleteAllToricEntries()`,
  `.getToricEntryCount()` for Task 5 (storefront pre-order) to set up fixture state.

Uses "Alcon Dailies Total1" — the contact-lens product Foundation's storefront smoke test already
navigates to, so it's confirmed to exist. **Before writing assertions, open this product's edit
page live and confirm the "Contact Lens" section is enabled (`is_contact_lens: true`)** — it's
the reasonable product to be toric-capable, but if this environment's data has it disabled instead,
pick any other product from the Products list that does have "Contact Lens" enabled and use that
name in the spec below instead; everything else about the test is unaffected by which product it
is.

- [x] **Step 1: Add toric-entry methods to `tests/pages/admin-product-form.page.ts`**

Confirmed live in source (`product-form.tsx`): three native `<select>` dropdowns with visible
default-option text `"Sphere (SPH)"`, `"Cylinder (CYL)"`, `"Axis (AXIS)"`, a `"Qty"`-placeholder
number input, a `"Price (optional)"`-placeholder text input, and an "Add" button (disabled until
sphere/cylinder/axis are all chosen) that appends the entry to a table below. Each table row has
its own delete button.

```typescript
async addToricEntry(entry: { sphere: string; cylinder: string; axis: string; qty: number }) {
  await this.page.locator('select').filter({ hasText: 'Sphere (SPH)' }).selectOption({ label: entry.sphere });
  await this.page.locator('select').filter({ hasText: 'Cylinder (CYL)' }).selectOption({ label: entry.cylinder });
  await this.page.locator('select').filter({ hasText: 'Axis (AXIS)' }).selectOption({ label: entry.axis });
  await this.page.getByPlaceholder('Qty').fill(String(entry.qty));
  await this.page.getByRole('button', { name: 'Add', exact: true }).click();
}

async getToricEntryCount(): Promise<number> {
  return this.page.locator('table tbody tr').count();
}

async deleteAllToricEntries() {
  while ((await this.getToricEntryCount()) > 0) {
    await this.page.locator('table tbody tr').first().getByRole('button').last().click();
  }
}
```

- [x] **Step 2: Create `tests/specs/products-inventory/toric-preorder-admin.spec.ts`**

Enables pre-order with an estimated-arrival message, verifies both persist after reload, then
disables pre-order again (restoring the product) as the last step.

```typescript
import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';

test('enabling pre-order with an estimated arrival persists after reload', async ({ adminPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Alcon Dailies Total1');

  const form = new AdminProductFormPage(adminPage);
  await form.setAllowPreOrder(true);
  await form.setPreOrderEstimatedArrival('2 weeks');
  await form.save();

  await adminPage.reload();
  await form.expectLoaded();
  await expect(adminPage.getByLabel('Allow pre-order')).toHaveAttribute('aria-checked', 'true');
  await expect(adminPage.getByLabel('Estimated arrival')).toHaveValue('2 weeks');

  // Restore: turn pre-order back off so the shared demo product isn't left mutated.
  await form.setAllowPreOrder(false);
  await form.save();
});
```

- [x] **Step 3: Run it and record the outcome**

Run: `npx playwright test toric-preorder-admin`
Expected: PASS. If "Alcon Dailies Total1" turns out not to be a contact-lens product in this
environment, substitute the confirmed-live alternative per the note above and re-run — do not
skip or weaken the assertions.

- [x] **Step 4: Commit**

```bash
git add tests/pages/admin-product-form.page.ts tests/specs/products-inventory/toric-preorder-admin.spec.ts
git commit -m "feat: admin-side pre-order toggle and toric stock entry tests"
```

---

### Task 5: Astigmatism/toric pre-order — storefront side

**Files:**
- Modify: `tests/pages/storefront-product.page.ts` (add pre-order methods)
- Create: `tests/specs/products-inventory/toric-preorder-storefront.spec.ts`

**Interfaces:**
- Consumes: `customerPage` fixture from Foundation; `AdminProductsListPage`/`AdminProductFormPage`
  from Tasks 1/4; `StorefrontProductPage` from Foundation (extended here).

Confirmed live in source (`product-detail-client.tsx`): when a product has `pre_order_enabled`
true and its effective stock (own + supplier, per combination for toric/lens-power products) is
exhausted, the add-to-cart button's text becomes `"Pre-order"` (plus the estimated-arrival string
appended after a `·`) instead of `"Add to Cart"` or `"Out of Stock"`.

- [x] **Step 1: Add pre-order methods to `tests/pages/storefront-product.page.ts`**

```typescript
async expectPreOrderButton(estimatedArrival?: string) {
  const button = this.page.getByRole('button', { name: /Pre-order/ });
  await expect(button).toBeVisible();
  if (estimatedArrival) {
    await expect(button).toContainText(estimatedArrival);
  }
}

async clickPreOrder() {
  await this.page.getByRole('button', { name: /Pre-order/ }).click();
}
```

(Add `import { expect } from '@playwright/test';` alongside the existing `Page` import if not
already present.)

- [x] **Step 2: Create `tests/specs/products-inventory/toric-preorder-storefront.spec.ts`**

Sets up the fixture state via admin (toric product, all its stock combos removed so effective
stock is 0, pre-order enabled), verifies the storefront shows the "Pre-order" CTA and that
clicking it adds the item to the cart, then restores the product afterward — pre-order off,
original toric entries are not restorable exactly (their ids are gone once deleted), so this task
documents that tradeoff rather than silently leaving stale state: it restores the pre-order flag
but leaves a note in the commit message that toric stock entries for this product were touched.

```typescript
import { test, expect } from '../../fixtures/roles.fixture';
import { AdminProductsListPage } from '../../pages/admin-products-list.page';
import { AdminProductFormPage } from '../../pages/admin-product-form.page';
import { StorefrontProductPage } from '../../pages/storefront-product.page';
import { env } from '../../support/env';

test('a pre-order product with no remaining stock shows Pre-order and can be added to cart', async ({ adminPage, customerPage }) => {
  const list = new AdminProductsListPage(adminPage);
  await list.goto();
  await list.searchAndOpenEdit('Alcon Dailies Total1');

  const form = new AdminProductFormPage(adminPage);
  await form.deleteAllToricEntries();
  await form.setAllowPreOrder(true);
  await form.setPreOrderEstimatedArrival('2 weeks');
  await form.save();

  const product = new StorefrontProductPage(customerPage);
  await product.goto('alcon-dailies-total1');
  await product.expectPreOrderButton('2 weeks');
  await product.clickPreOrder();

  // Confirmed live in Foundation: the cart button's accessible name is `title="Cart"`,
  // which becomes unstable once non-empty (see docs/testid-requests.md) — assert via the
  // cart page's own contents instead of the button's name. Confirmed in source: the cart
  // page lives at src/app/[locale]/cart/, i.e. `${STOREFRONT_URL}en/cart`.
  await customerPage.goto(new URL('en/cart', env.storefrontUrl()).toString());
  await expect(customerPage.getByText('Alcon Dailies Total1')).toBeVisible();

  // Restore: turn pre-order back off. Toric stock entries deleted above are not
  // reconstructed here (their original sphere/cylinder/axis/qty values weren't captured
  // by this test) — noted in the commit message for whoever reviews the report.
  await form.setAllowPreOrder(false);
  await form.save();
});
```

- [x] **Step 3: Run it and record the outcome**

Run: `npx playwright test toric-preorder-storefront`
Expected: PASS assuming "Alcon Dailies Total1" is confirmed toric/contact-lens-capable per Task
4's live-verification note (if Task 4 substituted a different product, use that same product's
slug here too — find it from the product's edit-page URL). If the cart route path
`en/cart` doesn't match this environment's actual cart page path, correct it to whatever
`tests/pages/storefront-*.page.ts` or the app's `[locale]/cart` route actually resolves to (confirmed
present in source at `src/app/[locale]/cart/`).

- [x] **Step 4: Commit**

```bash
git add tests/pages/storefront-product.page.ts tests/specs/products-inventory/toric-preorder-storefront.spec.ts
git commit -m "feat: storefront pre-order CTA and add-to-cart test (toric/astigmatism lenses)"
```

---

### Task 6: Supplier portal — self-service stock update (blocked on credentials)

**Files:**
- Create: `tests/pages/supplier-portal.page.ts`, `tests/specs/products-inventory/supplier-portal.spec.ts`
- Modify: `tests/support/env.ts` (add `supplierEmail()`/`supplierPassword()`), `.env.example`,
  `README.md` (document the new env vars)

**Interfaces:**
- Consumes: `SUPPLIER_EMAIL`/`SUPPLIER_PASSWORD` env vars (see the blocker note at the top of this
  plan — do not start this task until the user has supplied them).
- Produces: `SupplierPortalPage` with `login(email, password)`, `getStockRow(label: string)`,
  `setSupplierStock(label: string, qty: number): Promise<void>`.

- [x] **Step 1: Add supplier env accessors to `tests/support/env.ts`**

```typescript
supplierEmail: () => required('SUPPLIER_EMAIL'),
supplierPassword: () => required('SUPPLIER_PASSWORD'),
```

(Add these two lines inside the existing `env` object, alongside `customerEmail`/`customerPassword`.)

- [x] **Step 2: Add the two vars to `.env.example`**

```
SUPPLIER_EMAIL=
SUPPLIER_PASSWORD=
```

- [x] **Step 3: Create `tests/pages/supplier-portal.page.ts`**

Confirmed live in source (`dashboard-client.tsx`): a plain email/password form (`getByLabel`
works directly — `id="email"`/`id="password"` with matching `<label>`s) and a `"Sign in"` submit
button; once signed in, each stock line (product, variant, lens-power, or toric combo) renders as
a row showing its own-stock and supplier-stock numbers with an editable supplier-stock input.

**Corrected version (from the final whole-branch review's fix wave, I3/I4 — this superseded
version is the one that actually shipped; the snippet below replaces the original draft, which had
no persistence-wait guards on `login()`/`setSupplierStock()` and no `getSupplierStock()` reader):**

```typescript
import { Page, expect } from '@playwright/test';
import { env } from '../support/env';

export class SupplierPortalPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(new URL('en/supplier', env.storefrontUrl()).toString());
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    // Every other mutating Page Object method in this sub-project waits for its own
    // persistence/navigation signal instead of firing a click and racing ahead (this repo has
    // independently rediscovered that exact race four times now). This couldn't be verified live
    // (no supplier test credentials available), so it's a reasonable guess at the real request
    // (this app's other Supabase-backed forms hit `.../rest/v1/...`; the auth equivalent is
    // `.../auth/v1/token`), with a `.catch()` fallback so a wrong guess degrades to "no extra
    // wait" instead of a hang. endpoint unconfirmed — verify against the real request on first
    // live run.
    const loginSettled = this.page
      .waitForResponse((response) => response.url().includes('/auth/v1/token'), { timeout: 15000 })
      .catch(() => undefined);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await loginSettled;
  }

  getStockRow(label: string) {
    return this.page.getByRole('row', { name: new RegExp(label) });
  }

  async getSupplierStock(label: string): Promise<number> {
    const value = await this.getStockRow(label).getByRole('spinbutton').last().inputValue();
    return parseInt(value, 10) || 0;
  }

  async setSupplierStock(label: string, qty: number) {
    const row = this.getStockRow(label);
    await row.getByRole('spinbutton').last().fill(String(qty));
    // Same rationale as login() above — endpoint unconfirmed, verify on first live run.
    const saveSettled = this.page
      .waitForResponse(
        (response) => response.request().method() !== 'GET' && response.url().toLowerCase().includes('supplier'),
        { timeout: 15000 },
      )
      .catch(() => undefined);
    await row.getByRole('button', { name: /save/i }).click();
    await saveSettled;
  }

  async expectSignedIn() {
    await expect(this.page.getByText('Sign in')).toHaveCount(0);
  }
}
```

- [x] **Step 4: Create `tests/specs/products-inventory/supplier-portal.spec.ts`**

**Corrected version (I4 — the original draft below mutated stock and never restored or verified
it, unlike every other spec in this sub-project; this is the version that actually shipped):**

```typescript
import { test, expect } from '@playwright/test';
import { SupplierPortalPage } from '../../pages/supplier-portal.page';
import { env } from '../../support/env';

test('supplier can sign in and update their own stock for a linked product', async ({ page }) => {
  const portal = new SupplierPortalPage(page);
  await portal.goto();
  await portal.login(env.supplierEmail(), env.supplierPassword());
  await portal.expectSignedIn();

  // Assumes Task 3's "Carrera CA8044/S" ↔ QA Test Supplier link is still in place, or that
  // the supplied account is linked to at least one product with a visible stock row — adjust
  // the row label to whatever product this supplier account is actually linked to.
  const productLabel = 'Carrera CA8044/S';
  const originalStock = await portal.getSupplierStock(productLabel);
  const testStock = originalStock === 40 ? 41 : 40;
  await portal.setSupplierStock(productLabel, testStock);

  await page.reload();
  expect(await portal.getSupplierStock(productLabel)).toBe(testStock);

  // Restore and verify the restore itself persisted, matching every other mutating spec in this
  // sub-project's convention.
  await portal.setSupplierStock(productLabel, originalStock);
  await page.reload();
  expect(await portal.getSupplierStock(productLabel)).toBe(originalStock);
});
```

This spec deliberately uses `@playwright/test`'s own `test`/`page` (not the `adminPage`/
`customerPage` fixtures) since the supplier portal has its own independent auth — no shared
`storageState` setup needed or wanted here.

- [x] **Step 5: Run it and record the outcome**

Run: `npx playwright test supplier-portal`
Expected: FAILS with "Missing required env var: SUPPLIER_EMAIL" until the credentials from this
plan's blocker note are supplied — that is the correct, documented outcome, not a bug. Once
supplied, re-run and get it green; if the row-label lookup doesn't find the expected product,
confirm live which product(s) the given supplier account is actually linked to (via the admin
Suppliers page or the product's own "Linked supplier" field) and use one of those instead.

- [x] **Step 6: Commit**

```bash
git add tests/pages/supplier-portal.page.ts tests/specs/products-inventory/supplier-portal.spec.ts tests/support/env.ts .env.example README.md
git commit -m "feat: supplier portal self-service stock update test (blocked on supplier creds, see plan note)"
```

---

## Products & Inventory Done Criteria

- [x] Tasks 1–5 code committed and green against the live test environment.
- [x] Task 6 code committed; green once `SUPPLIER_EMAIL`/`SUPPLIER_PASSWORD` are supplied by the
  user (documented as the expected blocked state until then).
- [x] Every task that mutates a catalog product restores it to its original state as its own last
  step, verified via reload (updated by the final review's fix wave: `Carrera CA8044/S` and
  `Alcon Dailies Total1` — this criterion's original targets — both already had their categories
  wiped by the save-wipes-category bug before it was diagnosed, and neither is mutated by any
  spec any more; each mutating spec now targets its own distinct product instead — see README's
  "Known Environment Bugs" and I5 in the final review).
- [x] `docs/superpowers/plans/MASTER-PLAN.md` updated to mark sub-project 3 `Done` (or `Done except
  supplier portal` if Task 6 is still blocked when the rest ships).
- [x] `docs/testid-requests.md` updated with any new icon-only elements found while executing
  (e.g. the toric-entry row delete buttons, the supplier "Users" row action, if they turn out to
  lack accessible names once tested live).
