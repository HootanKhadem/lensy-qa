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

## CI

`.github/workflows/e2e.yml` runs on every push/PR to `main`, nightly at 03:00 UTC, and on demand. The HTML report is published to GitHub Pages after every run — see the repo's Pages URL for the latest results.
