# Lensy QA Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Playwright + TypeScript test project against the live Lensy test environment — scaffolding, dual-role auth (admin + customer), CI, and HTML reporting — with one real smoke test per role proving the whole pipeline works end to end. No feature-specific tests yet; those are separate follow-on plans (see the roadmap in the design spec).

**Architecture:** Single Playwright project (`chromium`, Desktop Chrome). A dedicated `setup` project (Playwright "project dependency") logs in as admin and as customer once via the real UI and saves two `storageState` files. Test-facing code then gets authenticated pages through two custom fixtures — `adminPage` and `customerPage` — each opening a fresh browser context with the matching `storageState`. This (not per-project baseURL/storageState) is the pattern because several later feature suites are cross-role (e.g. admin creates a coupon, customer redeems it) and need both roles available in the same spec file. Page Objects wrap all real DOM interaction so specs read as business flows, not selectors.

**Tech Stack:** `@playwright/test`, TypeScript, `dotenv`. GitHub Actions for CI. `peaceiris/actions-gh-pages` to publish the HTML report.

## Global Constraints

- Node.js 20+.
- Desktop Chrome only in this phase (`devices['Desktop Chrome']`) — no other browsers/viewports yet.
- All credentials and URLs come from environment variables (`ADMIN_URL`, `STOREFRONT_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CUSTOMER_EMAIL`, `CUSTOMER_PASSWORD`) — never hardcoded in source, never committed. Local values live in a gitignored `.env`; source them from `Credentials.txt`. CI values live in GitHub Actions Secrets.
- `storage/*.json` (saved auth state) and `.env` are gitignored — they contain live session data.
- No feature-specific test coverage in this plan — strictly scaffolding + one smoke test per role.

---

### Task 1: Project scaffold, TypeScript & Playwright config

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `playwright.config.ts`, `tests/support/env.ts`

**Interfaces:**
- Produces: `env` object from `tests/support/env.ts` with methods `adminUrl()`, `storefrontUrl()`, `adminEmail()`, `adminPassword()`, `customerEmail()`, `customerPassword()` — each returns a `string`, throws if the underlying env var is unset. Later tasks import `{ env } from '../support/env'` (path relative to file location).
- Produces: `playwright.config.ts` with two projects: `setup` (testDir `./tests/fixtures`, testMatch `/global\.setup\.ts/`) and `chromium` (testDir `./tests/specs`, `dependencies: ['setup']`).

- [ ] **Step 1: Init the Node project and install dependencies**

```bash
npm init -y
npm install -D @playwright/test typescript dotenv @types/node
```

- [ ] **Step 2: Install the Chromium browser binary**

```bash
npx playwright install --with-deps chromium
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "@playwright/test"]
  },
  "include": ["tests", "playwright.config.ts"]
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
.env
storage/
test-results/
playwright-report/
blob-report/
```

- [ ] **Step 5: Create `.env.example`**

```
ADMIN_URL=https://lensyadmin-test.lensydevelopment.workers.dev/
STOREFRONT_URL=https://lensyweb-test.lensydevelopment.workers.dev/
ADMIN_EMAIL=
ADMIN_PASSWORD=
CUSTOMER_EMAIL=
CUSTOMER_PASSWORD=
```

Copy it to `.env` locally and fill in real values from `Credentials.txt` (do not commit `.env`).

- [ ] **Step 6: Create `tests/support/env.ts`**

```typescript
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  adminUrl: () => required('ADMIN_URL'),
  storefrontUrl: () => required('STOREFRONT_URL'),
  adminEmail: () => required('ADMIN_EMAIL'),
  adminPassword: () => required('ADMIN_PASSWORD'),
  customerEmail: () => required('CUSTOMER_EMAIL'),
  customerPassword: () => required('CUSTOMER_PASSWORD'),
};
```

- [ ] **Step 7: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests/fixtures',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testDir: './tests/specs',
      dependencies: ['setup'],
    },
  ],
});
```

- [ ] **Step 8: Verify TypeScript compiles and Playwright is wired up**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx playwright test`
Expected: `Error: No tests found` from the `chromium`/`setup` projects is fine at this point — command should not crash with a config error. (If it reports a config/project error, fix before continuing.)

- [ ] **Step 9: Init git and commit**

```bash
git init
git add package.json package-lock.json tsconfig.json .gitignore .env.example playwright.config.ts tests/support/env.ts
git commit -m "chore: scaffold Playwright + TypeScript test project"
```

---

### Task 2: Admin auth + admin smoke test

**Files:**
- Create: `tests/pages/admin-login.page.ts`, `tests/pages/admin-dashboard.page.ts`, `tests/fixtures/global.setup.ts`, `tests/fixtures/roles.fixture.ts`, `tests/specs/foundation/admin-smoke.spec.ts`

**Interfaces:**
- Consumes: `env` from Task 1 (`tests/support/env.ts`).
- Produces: `AdminLoginPage` class (`goto()`, `login(email: string, password: string)`) and `AdminDashboardPage` class (`expectLoaded()`), both importable by later admin-facing suites.
- Produces: `test` and `expect` exported from `tests/fixtures/roles.fixture.ts`, with a `test.extend` fixture `adminPage: Page` — an authenticated page using `storage/admin.json`. Later tasks/suites import `{ test, expect } from '../../fixtures/roles.fixture'` instead of `@playwright/test` directly whenever they need an authenticated role.
- Produces: `storage/admin.json` on disk after the setup project runs.

- [ ] **Step 1: Create `tests/pages/admin-login.page.ts`**

```typescript
import { Page } from '@playwright/test';
import { env } from '../support/env';

export class AdminLoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(env.adminUrl());
  }

  async login(email: string, password: string) {
    await this.page.getByPlaceholder('Enter your email').fill(email);
    await this.page.getByPlaceholder('Enter your password').fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).click();
  }
}
```

- [ ] **Step 2: Create `tests/pages/admin-dashboard.page.ts`**

```typescript
import { Page, expect } from '@playwright/test';

export class AdminDashboardPage {
  constructor(private page: Page) {}

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(this.page.getByText('Welcome back, Test Admin')).toBeVisible();
  }
}
```

- [ ] **Step 3: Create `tests/fixtures/global.setup.ts` (admin half)**

```typescript
import { test as setup } from '@playwright/test';
import { AdminLoginPage } from '../pages/admin-login.page';
import { AdminDashboardPage } from '../pages/admin-dashboard.page';
import { env } from '../support/env';

setup('authenticate as admin', async ({ page }) => {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.login(env.adminEmail(), env.adminPassword());
  await new AdminDashboardPage(page).expectLoaded();
  await page.context().storageState({ path: 'storage/admin.json' });
});
```

- [ ] **Step 4: Create `tests/fixtures/roles.fixture.ts` (admin half)**

```typescript
import { test as base, expect, Page } from '@playwright/test';

type RoleFixtures = {
  adminPage: Page;
};

export const test = base.extend<RoleFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'storage/admin.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
```

- [ ] **Step 5: Create `tests/specs/foundation/admin-smoke.spec.ts`**

```typescript
import { test } from '../../fixtures/roles.fixture';
import { AdminDashboardPage } from '../../pages/admin-dashboard.page';
import { env } from '../../support/env';

test('admin can sign in and see the dashboard', async ({ adminPage }) => {
  await adminPage.goto(env.adminUrl());
  await new AdminDashboardPage(adminPage).expectLoaded();
});
```

- [ ] **Step 6: Run it and verify green**

Run: `npx playwright test admin-smoke`
Expected: 2 passed (the `setup` project's "authenticate as admin" test, and the `chromium` project's smoke test), and `storage/admin.json` now exists on disk.

- [ ] **Step 7: Commit**

```bash
git add tests/pages/admin-login.page.ts tests/pages/admin-dashboard.page.ts tests/fixtures/global.setup.ts tests/fixtures/roles.fixture.ts tests/specs/foundation/admin-smoke.spec.ts
git commit -m "feat: admin auth setup and smoke test"
```

---

### Task 3: Customer auth + storefront smoke test

**Files:**
- Create: `tests/pages/storefront-login-modal.page.ts`, `tests/pages/storefront-product.page.ts`, `tests/specs/foundation/storefront-smoke.spec.ts`
- Modify: `tests/fixtures/global.setup.ts` (add customer auth test), `tests/fixtures/roles.fixture.ts` (add `customerPage` fixture)

**Interfaces:**
- Consumes: `env` from Task 1; extends the `test`/`expect` exports and fixture pattern from Task 2.
- Produces: `StorefrontLoginModal` class (`open(url?: string)`, `login(email: string, password: string)`) and `StorefrontProductPage` class (`goto(slug: string)`, `expectProductName(name: string)`).
- Produces: `customerPage: Page` fixture added to `tests/fixtures/roles.fixture.ts`, same shape as `adminPage`.
- Produces: `storage/customer.json` on disk after the setup project runs.

- [ ] **Step 1: Create `tests/pages/storefront-login-modal.page.ts`**

```typescript
import { Page } from '@playwright/test';
import { env } from '../support/env';

export class StorefrontLoginModal {
  constructor(private page: Page) {}

  async open(url: string = env.storefrontUrl()) {
    await this.page.goto(url);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }

  async login(email: string, password: string) {
    await this.page.getByPlaceholder('Enter your email address').fill(email);
    await this.page.getByPlaceholder('Enter your password').fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).click();
  }
}
```

- [ ] **Step 2: Create `tests/pages/storefront-product.page.ts`**

```typescript
import { Page, expect } from '@playwright/test';
import { env } from '../support/env';

export class StorefrontProductPage {
  constructor(private page: Page) {}

  async goto(slug: string) {
    await this.page.goto(`${env.storefrontUrl()}en/product/${slug}`);
  }

  async expectProductName(name: string) {
    await expect(this.page.getByRole('heading', { name })).toBeVisible();
  }
}
```

- [ ] **Step 3: Add the customer auth test to `tests/fixtures/global.setup.ts`**

Append below the existing `setup('authenticate as admin', ...)` block:

```typescript
import { StorefrontLoginModal } from '../pages/storefront-login-modal.page';

setup('authenticate as customer', async ({ page }) => {
  const loginModal = new StorefrontLoginModal(page);
  await loginModal.open();
  await loginModal.login(env.customerEmail(), env.customerPassword());
  await page.getByRole('button', { name: 'Sign in' }).waitFor({ state: 'detached' });
  await page.context().storageState({ path: 'storage/customer.json' });
});
```

(Move the `StorefrontLoginModal` import to the top of the file alongside the existing imports.)

- [ ] **Step 4: Add the `customerPage` fixture to `tests/fixtures/roles.fixture.ts`**

Update the file to:

```typescript
import { test as base, expect, Page } from '@playwright/test';

type RoleFixtures = {
  adminPage: Page;
  customerPage: Page;
};

export const test = base.extend<RoleFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'storage/admin.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  customerPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'storage/customer.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
```

- [ ] **Step 5: Create `tests/specs/foundation/storefront-smoke.spec.ts`**

```typescript
import { test } from '../../fixtures/roles.fixture';
import { StorefrontProductPage } from '../../pages/storefront-product.page';

test('signed-in customer can view a product page', async ({ customerPage }) => {
  const product = new StorefrontProductPage(customerPage);
  await product.goto('alcon-dailies-total1');
  await product.expectProductName('Alcon Dailies Total1');
});
```

- [ ] **Step 6: Run the full suite and verify green**

Run: `npx playwright test`
Expected: all tests pass (2 setup tests + 2 smoke tests), `storage/admin.json` and `storage/customer.json` both exist.

- [ ] **Step 7: Commit**

```bash
git add tests/pages/storefront-login-modal.page.ts tests/pages/storefront-product.page.ts tests/specs/foundation/storefront-smoke.spec.ts tests/fixtures/global.setup.ts tests/fixtures/roles.fixture.ts
git commit -m "feat: customer auth setup and storefront smoke test"
```

---

### Task 4: Test-id ask-list doc

**Files:**
- Create: `docs/testid-requests.md`

**Interfaces:**
- Produces: a markdown table other tasks/suites append rows to whenever a Page Object can't reliably target an element by text/role/label.

- [ ] **Step 1: Create `docs/testid-requests.md`**

```markdown
# Test ID Requests

Elements we can't reliably target by visible text, ARIA role, or label. Each row is a small ask for the dev — adding the suggested `data-testid` makes the matching Page Object more robust to copy/layout changes. Not a blocker: tests ship with a best-effort selector (noted below) and get tightened once the id lands.

| Page | Element | Why it's hard to target | Current selector (best-effort) | Suggested `data-testid` |
|------|---------|---------------------------|----------------------------------|---------------------------|
| Storefront header | Account menu button shown after a customer signs in (replaces the "Sign in" button) | No visible text and no `aria-label` once signed in | Positional (`nth` in the header's button list) | `account-menu-button` |
```

- [ ] **Step 2: Commit**

```bash
git add docs/testid-requests.md
git commit -m "docs: start test-id ask-list"
```

---

### Task 5: CI pipeline, report publishing, README

**Files:**
- Create: `.github/workflows/e2e.yml`, `README.md`

**Interfaces:**
- Consumes: the `chromium`/`setup` Playwright projects from Task 1, the full passing suite from Tasks 2–3.
- Produces: a GitHub Actions workflow named `E2E Tests` that other sub-project plans extend by adding their own spec files (no workflow changes needed per suite).

- [ ] **Step 1: Create `.github/workflows/e2e.yml`**

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  e2e:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - run: npx playwright install --with-deps chromium

      - run: npx playwright test
        env:
          ADMIN_URL: ${{ secrets.ADMIN_URL }}
          STOREFRONT_URL: ${{ secrets.STOREFRONT_URL }}
          ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
          CUSTOMER_EMAIL: ${{ secrets.CUSTOMER_EMAIL }}
          CUSTOMER_PASSWORD: ${{ secrets.CUSTOMER_PASSWORD }}

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

      - name: Publish report to GitHub Pages
        if: always()
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./playwright-report
```

- [ ] **Step 2: Create `README.md`**

```markdown
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
```

- [ ] **Step 3: Verify the suite is green one more time before pushing**

Run: `npx playwright test`
Expected: all pass.

- [ ] **Step 4: Commit, push, and confirm CI**

```bash
git add .github/workflows/e2e.yml README.md
git commit -m "ci: add GitHub Actions workflow and report publishing"
git push -u origin main
```

Then open the repo's Actions tab, confirm the `E2E Tests` workflow runs green, and confirm the published report URL (repo Settings → Pages, branch `gh-pages`) loads and shows the 4 passing tests.

---

## Foundation Done Criteria (recap)

- [ ] `npm test`-equivalent (`npx playwright test`) passes locally against the test environment.
- [ ] `storage/admin.json` and `storage/customer.json` both generated by the setup project.
- [ ] One real smoke test per role passes (admin dashboard, customer product page).
- [ ] CI workflow green on push; HTML report published and reachable at a stable URL.
- [ ] `docs/testid-requests.md` exists with at least the account-menu-button entry.

Once all boxes are checked, the next session picks up sub-project 2 (Orders & Operations) from the roadmap in `docs/superpowers/specs/2026-08-04-lensy-qa-foundation-design.md`.
