# Test ID Requests

Elements we can't reliably target by visible text, ARIA role, or label. Each row is a small ask for the dev — adding the suggested `data-testid` makes the matching Page Object more robust to copy/layout changes. Not a blocker: tests ship with a best-effort selector (noted below) and get tightened once the id lands.

| Page | Element | Why it's hard to target | Current selector (best-effort) | Suggested `data-testid` |
|------|---------|---------------------------|----------------------------------|---------------------------|
| Storefront header | Account menu button shown after a customer signs in (replaces the "Sign in" button) | No visible text and no `aria-label` once signed in | `header button[aria-haspopup="menu"]` (relies on the Radix dropdown-trigger attribute, not a stable id) | `account-menu-button` |
| Storefront header | Region/currency toggle button (shows current currency code, e.g. "USD"/"KWD") | No stable accessible name beyond the currency code text, which changes | `getByRole('button', { name: /USD\|KWD/ })` scoped to `header` | `region-toggle-button` |
| Storefront checkout | Payment Method radio inputs | Labels depend on which payment methods the backend returns — currently broken (returns none), so no live-verified selector exists | `label:has-text("Cash on Delivery")` (best-effort, unverified) | `payment-method-cod` |
| Storefront checkout | Area `<select>` in the Shipping Address form | No `aria-label`, `name`, or associated `<label for>` — "Select area" is only the text of the placeholder `<option>`, not the element's accessible name, so `getByRole('combobox', { name: 'Select area' })` matches nothing | `getByRole('combobox')` (only one combobox on the checkout page at this point in the flow, so unscoped works but is fragile if a second one is added) | `checkout-area-select` |
