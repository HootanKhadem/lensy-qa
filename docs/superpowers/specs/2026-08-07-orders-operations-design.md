# Orders & Operations — Design

Date: 2026-08-07

## Context

Second sub-project in the Lensy QA roadmap (see `docs/superpowers/specs/2026-08-04-lensy-qa-foundation-design.md` for the full 7-part plan and the Foundation scaffolding this builds on: Playwright + TypeScript, `adminPage`/`customerPage` role fixtures, CI, HTML reporting).

Scope: the 3 delivered features under the "Orders & Operations" category on the feature-list checklist:
1. QR code on invoice (scan to update status / contact customer)
2. Print invoice → auto status "Preparing"
3. Allow editing invoices (products, address, all details)

## Exploration findings (live admin panel, `/orders`)

- Orders list: status-filter tabs (Pending/Preparing/Shipped/Delivered/All), search box, per-row menu → "Order Details" opens the detail page.
- Order detail page (`/orders/:id`): **Print Invoice** button, **Copy ID**, editable **Customer Information** (pencil icon → name/email/phone), editable **Shipping Address** (pencil icon), **Order Items** (Add item, per-line Edit/Delete), **Order Summary** (subtotal/shipping/total), **Update Status** dropdown, Payment Method/Status, Timeline.
- Clicking Print Invoice triggers `window.print()` and, confirmed via network capture, generates a QR code as a `data:image` — the QR is real and present, not decorative.
- The storefront defaults to an auto-detected "International" region (USD, free-text address, and in this test env: **no delivery methods configured**, which blocks checkout entirely). A header toggle switches to local/Kuwait mode (KWD, governorate-based address, working delivery + COD payment) — this is the mode test checkout must use.
- A real console error was observed on an order-detail page load: `Uncaught ReferenceError: __name is not defined`. Origin/impact unconfirmed — folding a "no uncaught console errors" assertion into this suite turns the discovery into permanent regression coverage rather than chasing it down now.

## Test data strategy

Every test places its own real order via the storefront checkout, then operates on it as admin. Fully isolated (safe under parallel workers), and incidentally proves checkout itself works end-to-end. Admin-side steps locate "their" order by searching its order number in the Orders list search box — never by list position, since concurrent tests are placing orders at the same time.

## Architecture

**New shared flow:** `tests/flows/checkout.flow.ts` — `placeOrder()` function usable by any suite (this one now; Offers & Marketing later for coupon testing). Steps: navigate to a simple product (no astigmatism pre-order complexity needed), select lens power for both eyes, add to cart, switch to local/Kuwait mode via the header toggle, fill required address fields, select COD payment, place order, return the order number parsed from the confirmation.

**New Page Objects:**
- `tests/pages/admin-orders-list.page.ts` — `searchAndOpen(orderNumber)`.
- `tests/pages/admin-order-detail.page.ts` — status dropdown read/set, `printInvoice()`, edit customer info, edit shipping address, add/edit/delete line item, read totals.

**New dependency:** `jsqr` (dev dependency) to decode the QR code's pixel data into its encoded URL.

## Test list

**Print → status:**
- Fresh order (starts "Pending") → print invoice → assert status becomes "Preparing".
- Fresh order → advance to "Shipped" via the status dropdown → print invoice → assert status stays "Shipped" (does not revert).

**QR code:**
- Print invoice → extract the generated QR image from the DOM → decode with `jsqr` → navigate to the decoded URL in a fresh browser context → assert it exposes the promised capability (update status and/or contact customer). The exact shape of that URL/page is unknown until implementation inspects it directly — no guessing in this spec.

**Edit invoice (exhaustive, per approval):**
- Edit customer name/email/phone → persists after reload.
- Edit shipping address → persists after reload.
- Add a line item → item count and totals recalculate correctly.
- Edit a line item's quantity and power → totals recalculate correctly.
- Delete a line item → item count and totals recalculate correctly.

**Regression coverage:**
- No uncaught console errors on the order-detail page (catches the `__name is not defined` error and any future regressions like it).

## Out of scope

- Governorate-dropdown UX itself (belongs to the Customer Experience sub-project) — this suite uses it only functionally, to get through checkout.
- Delivery-charge-per-area and free-delivery-threshold pricing rules (also Customer Experience).
- Driver assignment / shipping carrier workflows beyond what's needed to reach "Shipped" for the negative print-status test.
