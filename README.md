# Lensy QA Automation

Playwright + TypeScript end-to-end test suite for Lensy (storefront + admin panel), run against a dedicated test environment.

## Setup

1. `npm install`
2. `npx playwright install --with-deps chromium`
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

## CI

`.github/workflows/e2e.yml` runs on every push/PR to `main`, nightly at 03:00 UTC, and on demand. The HTML report is published to GitHub Pages after every run — see the repo's Pages URL for the latest results.
