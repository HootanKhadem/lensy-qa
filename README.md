# Lensy QA Automation

Playwright + TypeScript end-to-end test suite for Lensy (storefront + admin panel), run against a dedicated test environment.

## Setup

1. `npm install`
2. `npx playwright install --with-deps chrome`
   - Playwright is pinned to the `chrome` channel (see `playwright.config.ts`), so this requires Google Chrome to already be installed on your machine. CI works out of the box because GitHub Actions' `ubuntu-latest` runners ship Google Chrome preinstalled.
3. Copy `.env.example` to `.env` and fill in values from `Credentials.txt` (never commit `.env`).

## Running tests

- All tests: `npx playwright test`
- One file: `npx playwright test admin-smoke`
- View last HTML report: `npx playwright show-report`

## Environment Variables

The following environment variables must be set in `.env` (copy from `.env.example`):

- `ADMIN_URL` — Admin panel base URL
- `STOREFRONT_URL` — Customer storefront base URL
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — Admin user credentials
- `CUSTOMER_EMAIL` / `CUSTOMER_PASSWORD` — Customer user credentials
- `SUPPLIER_EMAIL` / `SUPPLIER_PASSWORD` — Supplier portal user credentials (required only for supplier portal tests; see the Task 6 blocker note in `docs/superpowers/plans/2026-09-02-products-inventory.md`)

## Structure

- `tests/pages/` — Page Objects, one class per screen/component.
- `tests/fixtures/` — auth setup (`global.setup.ts`) and role fixtures (`adminPage`, `customerPage`) used by every spec.
- `tests/specs/<category>/` — one folder per feature category from the delivery checklist.
- `tests/support/` — shared helpers (env access, test data).
- `docs/testid-requests.md` — running ask-list of elements that would benefit from a `data-testid` in the app.

## Known Environment Bugs

Two real, live bugs in this test environment currently block most tests in the
`orders-operations` suite from running to completion. Both are application/environment bugs, not
test bugs — the tests are written to fail exactly at these points until the underlying issue is
fixed.

- **`POST /api/payment/methods` returns HTTP 500.** Confirmed live: on the storefront checkout
  page, the "Payment Method" section never renders any payment-method options (it shows "No
  payment methods available" and "Place Order & Pay" stays disabled) because the API call that's
  supposed to populate it fails server-side. This blocks every test whose flow goes through
  `placeOrder()` (`tests/flows/checkout.flow.ts`) from placing a real order — they fail inside
  `StorefrontCheckoutPage.selectCashOnDelivery()`, waiting for a Cash-on-Delivery option that
  never appears.
- **The printed invoice's QR code encodes a hardcoded `lensy.app` production domain that soft-404s
  in this test environment.** Confirmed live (read-only `curl` against the decoded QR URL): the
  QR on a printed invoice encodes an absolute URL of the form `https://lensy.app/en/o/{uuid}` —
  that hostname is hardcoded in the app, not derived from `STOREFRONT_URL`
  (`lensyweb-test.lensydevelopment.workers.dev` in this environment). Hitting that exact URL
  returns HTTP 200 but with a generic "The Page/Resource You Requested Could Not Be Found" error
  page — a soft 404, not a working order page — even though the equivalent path against the real
  test storefront domain (`${STOREFRONT_URL}/o/{uuid}`) does render a working order page. This
  blocks `tests/specs/orders-operations/qr-code.spec.ts` from passing its final assertions once
  the payment-methods bug above is fixed.

A third, silently-destructive bug affects the admin product edit form used throughout
`products-inventory`:

- **Saving a product via the admin edit form's Save button unconditionally clears its category.**
  Confirmed live (originally on "Cerruti 1881 CE8117" in
  `tests/specs/products-inventory/preorder-storefront.spec.ts`): clicking Save wipes
  `category_ids`/`category_id` back to empty/`null` even on a save that never touched the
  Category checkbox tree at all — reproduced repeatedly against a real product via the API
  response, not just the UI. The only way found to make a category survive a save is to actually
  toggle its checkbox off then back on during the same page session immediately before clicking
  Save (merely having it already checked on page load isn't enough), and even that isn't fully
  reliable — it still occasionally didn't stick across repeated real runs, for reasons that
  couldn't be pinned down further without the app's source. This doesn't block any test outright,
  but it silently destroys data: any `products-inventory` spec that calls
  `AdminProductFormPage.save()` without deliberately re-affirming category will erase whatever
  category the product had. `AdminProductFormPage.saveReaffirmingCategory(categoryName)` is the
  shared defense every mutating spec in this sub-project now uses in place of a bare `save()`.
  Confirmed current state (live, checked while fixing the tests below) of every product this
  sub-project's specs call `save()` on:
  - **"Carrera CA8044/S"** (`product-form-smoke.spec.ts`, read-only) — `category_ids: []`. Lost
    its category from earlier tasks' bare `save()` calls before this bug was identified, and is
    no longer saved by any spec in this suite (only read).
  - **"Alcon Dailies Total1"** (no longer used by any spec in this suite; originally Task 4's
    `toric-preorder-admin.spec.ts` target) — also `category_ids: []`, lost the same way, before
    anyone realized it was a second victim. Left as-is, undamaged further, since nothing in this
    suite touches it anymore — restoring its category is a manual admin-panel data fix, same as
    "Carrera CA8044/S" above, not something this test suite does to live data itself.
  - **"Cerruti 1881 CE8117"** (`preorder-storefront.spec.ts`) — category intact
    (`category_ids: ["c1000001-0000-0000-0000-000000000006"]`, "Sun Glasses"), actively defended
    by `saveReaffirmingCategory('Sun Glasses')` on every save this spec makes.
  - **"Santos"** (`expiry-date.spec.ts`), **"Vitorio"** (`supplier-stock.spec.ts`), and
    **"Precision 30 pack"** (`preorder-admin.spec.ts`) — all confirmed live to have intact
    categories, each now defended the same way by its own spec.

- **Removing a toric stock combination row in the admin edit form and clicking Save does not
  delete it from the database.** Confirmed live and via `lensyadmin` source
  (`src/app/api/le/product-toric-stock/route.ts`'s `POST` handler): the form's Save button only
  ever bulk-*upserts* the sphere/cylinder/axis combinations still present in the form's local
  state — it never calls the sibling per-entry `DELETE /api/le/product-toric-stock/[id]` route
  (also present in source, fully implemented) for a combination removed from the UI's local list.
  The row disappears from the table immediately (local React state) and the Save request's
  payload correctly omits it, but the previously-persisted database row for that combination is
  never actually deleted — it silently reappears on the next reload. `AdminProductFormPage`'s
  `deleteToricEntryPermanently()` works around this by calling the per-entry `DELETE` route
  directly instead of relying on the form's (non-functional for this purpose) delete-row-then-Save
  flow; any future test that needs to remove a toric stock combination it added should use that,
  not a plain UI delete + `save()`.

## CI

`.github/workflows/e2e.yml` runs on every push/PR to `main`, nightly at 03:00 UTC, and on demand. The HTML report is published to GitHub Pages after every run — see the repo's Pages URL for the latest results.
