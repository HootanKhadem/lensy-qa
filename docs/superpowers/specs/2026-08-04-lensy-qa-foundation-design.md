# Lensy QA Automation — Roadmap & Foundation Design

Date: 2026-08-04

## Context

Product: Lensy — eyewear/contact lens e-commerce (public storefront + admin panel), both hosted on Cloudflare Workers test subdomains. No source code access; testing is strictly black-box against the deployed test environment.

Source of truth for scope: `Feature List.jpg` — 8 categories, 21 delivered-status rows, provided by the developer as their delivery checklist. 4 items are marked as NOT delivered:

- Message templates → WhatsApp/SMS (with product name/image)
- Custom recurring notifications
- DHL / shipping carrier APIs
- Virus scan on uploaded prescription files

Test credentials (`Credentials.txt`, not duplicated here — treat as secret):
- Admin panel + login
- Customer account + login
- Storefront test URL, admin panel test URL

## Goals & Constraints

- **Purpose:** ongoing QA product owned by the team — not a one-off acceptance check. Will be presented to the employer and re-run on future deploys.
- **Test data:** environment is a fully disposable sandbox — tests may freely create/mutate orders, invoices, discounts, supplier stock.
- **Team skill:** JS/TS comfortable.
- **Browser scope (v1):** Desktop Chrome only. Mobile/cross-browser deferred until suite is proven.
- **Locators:** black-box (text/role/label) by default; dev can add `data-testid` attributes on request — tracked via an ask-list, not a blocker.
- **Test scope:** UI end-to-end, plus light assertions on network responses Playwright can observe (e.g. order totals, discount calculations) where useful.
- **Footnote marks (†‡§*,**) on the feature list:** confirmed not meaningful — treat all ✅ rows as fully delivered.

## Chosen Stack

- **Framework:** Playwright + TypeScript.
- **Test organization:** Playwright fixtures + lightweight Page Objects (official Playwright pattern) — Page Object classes injected as fixtures. Chosen over Screenplay pattern (too much ceremony for this scope) and flat helper functions (doesn't scale past ~30 tests without duplication).
- **Auth:** one-time global setup logs in as admin and as customer via the UI, saves two `storageState` files; all specs reuse the relevant state instead of logging in per test.
- **Reporting:** Playwright's built-in HTML report (trace viewer, screenshots, video on failure) published to GitHub Pages after each CI run, giving a stable link to show the employer. Allure deferred — only worth adding later if cross-run trend history becomes valuable.
- **CI:** GitHub Actions, running on push/PR to main and on a nightly schedule (to catch environment drift even with no code changes).

## Multi-Session Roadmap (sub-projects)

This program is too large for one spec/plan. It decomposes into 7 sub-projects, each with its own spec → plan → implementation cycle:

1. **Foundation** (this document) — scaffolding, config, auth, CI, reporting, test-id ask-list process, one smoke test per role proving the pipeline end-to-end. Everything else depends on this landing first.
2. **Orders & Operations** — QR code on invoice (scan → update status/contact customer), print invoice → auto status "Preparing", editing invoices (products, address, all details).
3. **Products & Inventory** — pre-order for astigmatism lenses, expiry date field (admin), supplier stock field, supplier panel/link for suppliers to update their own stock.
4. **Customer Experience** — governorate dropdown (replacing manual area input), delivery charge per area, free delivery above order threshold, international option with USD currency.
5. **Offers & Marketing** — 1+1 offer, 1+2 offer, custom % discounts, coupon reporting (total order value generated per code).
6. **Analytics & Reports** — detailed reports section in the analytics page.
7. **Negative-verification** — confirm the 4 features marked ✗ are in fact absent/inert (WhatsApp/SMS templates, recurring notifications, DHL API, virus scan). Proves the delivery checklist honest in both directions; valuable evidence for the employer.

## Foundation Sub-Project — Detailed Design

### Repo structure

```
/tests
  /fixtures        # Playwright fixtures: auth, page objects wired in
  /pages           # Page Object classes (AdminLoginPage, StorefrontHomePage, etc.)
  /specs
    /orders-operations
    /products-inventory
    /customer-experience
    /offers-marketing
    /analytics-reports
    /negative-verification
  /support         # test data builders, constants (e.g. governorates list)
playwright.config.ts
.github/workflows/e2e.yml
docs/testid-requests.md
```

### Config

Two Playwright "projects": `admin` and `storefront`, each pointed at its worker URL. Secrets (`ADMIN_URL`, `STOREFRONT_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CUSTOMER_EMAIL`, `CUSTOMER_PASSWORD`) live in a gitignored `.env` locally and in GitHub Actions Secrets in CI — never committed in plaintext.

### Auth

A Playwright global setup script logs in as admin and as customer through the real UI once, saving `storageState` JSON per role. Specs consume the matching state via fixtures — no repeated logins, no login-flake in unrelated tests.

### Test-id ask-list

Whenever a Page Object can't reliably target an element via text/role/label, it's logged to `docs/testid-requests.md` (element description, page, suggested `data-testid` name). This file is handed to the dev in batches; it does not block test authoring — tests ship with best-effort selectors and get tightened once ids land.

### CI & reporting

`.github/workflows/e2e.yml`: install deps → `playwright install --with-deps chromium` → run suite → upload HTML report as artifact → publish to `gh-pages` branch for a stable shareable URL. Playwright auto-captures trace + screenshot + video on failure, viewable directly from the report.

### Done criteria for Foundation

- Repo scaffolded; `npm test` runs locally against the test environment.
- Admin and customer `storageState` auth both work.
- One real smoke test per role passes end-to-end (e.g. admin: log in → see dashboard; customer: log in → view a product page) — not a placeholder test.
- CI workflow green on a push; HTML report published and the link works.
- `docs/testid-requests.md` exists (template, possibly still empty).

No feature-specific tests are written in this sub-project — those belong to sub-projects 2–7 above.
