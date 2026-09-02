# Lensy E2E — Master Plan

Living tracking document, updated every session. Source of truth for scope: `Feature List.jpg`
(21 rows, 8 categories). Full architecture/roadmap rationale lives in
[`docs/superpowers/specs/2026-08-04-lensy-qa-foundation-design.md`](../specs/2026-08-04-lensy-qa-foundation-design.md) —
this file is the checklist; that one is the "why."

**How to resume in a new session:** read this file top to bottom, find the first sub-project
that isn't `Done`, open its plan doc, and either finish an in-progress plan or run
`superpowers:writing-plans` to write the next one following the pattern of the existing plans.

## 2026-09-02 update — source code access

We now have read access to both client repos, each with its own `graphify` knowledge graph
already built:

- `F:\work\Artman\Lensy Project\lensyadmin` (admin panel, Next.js)
- `F:\work\Artman\Lensy Project\lensyweb` (storefront + supplier portal + driver app, Next.js)

Query them with `graphify query "<question>"` (run from inside that repo dir) instead of
grepping blind — the graph is already extracted, so this is fast. This does **not** turn the
suite into a white-box/unit-test project — tests still drive the real deployed test environment
through the UI exactly as before. Source access only means plans no longer need "investigate
live" placeholders for selectors/field names/routes; write the real ones up front, then confirm
live when executing (source can drift from what's actually deployed).

## Sub-projects

| # | Sub-project | Status | Plan doc |
|---|---|---|---|
| 1 | Foundation | ✅ Done | [2026-08-04-lensy-qa-foundation.md](2026-08-04-lensy-qa-foundation.md) |
| 2 | Orders & Operations | ⚠️ Built, blocked live (see below) | [2026-08-07-orders-operations.md](2026-08-07-orders-operations.md) |
| 3 | Products & Inventory | ✅ Done except supplier portal (blocked on creds) | [2026-09-02-products-inventory.md](2026-09-02-products-inventory.md) |
| 4 | Customer Experience | ⬜ Not started | — |
| 5 | Offers & Marketing | ⬜ Not started | — |
| 6 | Analytics & Reports | ⬜ Not started | — |
| 7 | Negative-verification (the 4 ✗ features) | ⬜ Not started | — |

**Sub-project 2 note:** all 6 tasks are built and committed, but most tests fail at a documented
point due to two live environment bugs (`POST /api/payment/methods` 500, and the printed
invoice's QR code hardcoding `lensy.app` instead of the test domain) — see the README's "Known
Environment Bugs" section. **Before resuming sub-project 4+ work that also needs `placeOrder()`
to complete** (anything needing a real order), re-check these two bugs first — now that source
is available, `graphify query` or a direct read of `lensyweb/src/app/api/payment/methods/route.ts`
can confirm the root cause in seconds instead of re-doing black-box detective work.

**Sub-project 3 status (updated after the final whole-branch fix wave):** all 6 tasks are built,
committed, and (aside from Task 6) passing green against the live test environment, including a
consolidated fix wave that closed out the whole-branch review's findings. Notable outcomes from
that fix wave:
- The admin product-form "Save wipes category" bug (found mid-sub-project) is now defended by a
  shared `AdminProductFormPage.saveReaffirmingCategory()` helper used by every spec that saves a
  product with a real category, not just the one spec that originally discovered it.
- A second, previously-undocumented bug was found and fixed around: removing a toric stock
  combination row in the admin form and clicking Save does **not** actually delete it
  server-side (confirmed via `lensyadmin` source) — see README.md's "Known Environment Bugs".
- Toric/astigmatism now has real, working coverage (`toric-stock-entry.spec.ts`, against "ACUVUE
  OASYS for Astigmatism (6 Pack)", the one catalog product confirmed live to have "Toric /
  Astigmatism" genuinely enabled with real stock data) — the two specs formerly named
  `toric-preorder-admin.spec.ts` / `toric-preorder-storefront.spec.ts` were renamed to
  `preorder-admin.spec.ts` / `preorder-storefront.spec.ts` since they only ever exercised the
  generic `pre_order_enabled` flag, not toric-specific fields.
- Each mutating spec (expiry-date, supplier-stock, preorder-admin, preorder-storefront,
  toric-stock-entry) now targets its own distinct catalog product, so no two specs race each
  other's admin-form saves against the same product record under this suite's `fullyParallel`
  execution.

**Sub-project 3 blocker (Task 6 only):** the supplier-portal half of the plan needs a real
supplier test account (email + password), the same way `Credentials.txt` has admin/customer
creds. The admin UI's only way to create one is "Send invite" (`suppliers-content.tsx`), which
emails a real Supabase invite link — our automation can't read that inbox. **Ask the user** to
either (a) supply a pre-created supplier email/password, or (b) supply access to the inbox the
invite would land in, or (c) confirm a way to set the password directly (e.g. via Supabase
dashboard) after sending the invite. Task 6's code is written, committed, and documented-blocked
(fails with a clear "missing env var" error until credentials are supplied) — everything else in
sub-project 3 does not need this and is unaffected.

## Full feature checklist (from `Feature List.jpg`)

Legend: **Delivered** = the product feature list's own ✅/✗ for that row (not our test status).
**E2E coverage** = whether this repo has a passing/attempted test for it yet.

| Category | Feature | Delivered | Sub-project | E2E coverage |
|---|---|---|---|---|
| Orders & Operations | QR code on invoice (scan → update status/contact customer) | ✅ | 2 | Written, blocked by QR-domain bug |
| Orders & Operations | Print invoice → auto status "Preparing" | ✅ | 2 | Written, blocked by checkout bug |
| Orders & Operations | Allow editing invoices (products, address, all details) | ✅ | 2 | Done (customer/address/line-items all covered) |
| Products & Inventory | Pre-order option for lenses with astigmatism | ✅ | 3 | Done — generic pre-order flag covered by `preorder-admin.spec.ts`/`preorder-storefront.spec.ts`; toric/astigmatism-specific stock combinations covered separately by `toric-stock-entry.spec.ts` |
| Products & Inventory | Expiry date field per product (admin panel) | ✅ | 3 | Done (`expiry-date.spec.ts`) |
| Products & Inventory | Supplier stock field (separate from our stock) | ✅ | 3 | Done (`supplier-stock.spec.ts`) |
| Products & Inventory | Supplier panel/link (suppliers update their own stock) | ✅ | 3 | Written, blocked on supplier test creds (`supplier-portal.spec.ts`) |
| Customer Experience | Replace manual area input with governorate dropdown | ✅ | 4 | Not started |
| Customer Experience | Set delivery charge per area | ✅ | 4 | Not started |
| Customer Experience | Free delivery above X order value | ✅ | 4 | Not started |
| Customer Experience | International option (USD currency) | ✅ | 4 | Not started |
| Communication & Automation | Message templates → WhatsApp/SMS (with product name/image) | ✗ | 7 | Not started |
| Communication & Automation | Custom recurring notifications | ✗ | 7 | Not started |
| Offers & Marketing | Offers: 1+1 | ✅ | 5 | Not started |
| Offers & Marketing | Offers: 1+2 | ✅ | 5 | Not started |
| Offers & Marketing | Custom discounts (%) | ✅ | 5 | Not started |
| Offers & Marketing | Coupons show total order value generated per code | ✅ | 5 | Not started |
| Integrations | DHL / shipping carrier APIs | ✗ | 7 | Not started |
| Analytics & Reports | Detailed reports section in analytics page | ✅ | 6 | Not started |
| Security | Virus scan on uploaded prescription files | ✗ | 7 | Spot-checked via source grep (no virus/clamav/prescription-upload code found in lensyweb) — needs a proper read before calling it confirmed |

## Notes for sub-project 7 (negative-verification)

Source grep already gives a head start, but was noisy (false-positive substring hits) for
WhatsApp/SMS/recurring-notifications and DHL — worth a deliberate `graphify query` pass per
repo (e.g. `graphify query "how are order status notifications sent to customers"` in
`lensyweb`) rather than trusting the raw grep hit list. Do this properly when sub-project 7 is
picked up; don't rely on this session's quick spot-check beyond the virus-scan row above.
