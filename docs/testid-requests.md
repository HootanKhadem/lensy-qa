# Test ID Requests

Elements we can't reliably target by visible text, ARIA role, or label. Each row is a small ask for the dev — adding the suggested `data-testid` makes the matching Page Object more robust to copy/layout changes. Not a blocker: tests ship with a best-effort selector (noted below) and get tightened once the id lands.

| Page | Element | Why it's hard to target | Current selector (best-effort) | Suggested `data-testid` |
|------|---------|---------------------------|----------------------------------|---------------------------|
| Storefront header | Account menu button shown after a customer signs in (replaces the "Sign in" button) | No visible text and no `aria-label` once signed in | `header button[aria-haspopup="menu"]` (relies on the Radix dropdown-trigger attribute, not a stable id) | `account-menu-button` |
