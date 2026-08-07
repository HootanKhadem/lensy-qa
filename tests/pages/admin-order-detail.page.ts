import { Page, expect } from '@playwright/test';

export class AdminOrderDetailPage {
  constructor(private page: Page) {}

  async printInvoice() {
    await this.page.getByRole('button', { name: 'Print Invoice' }).click();
  }

  async printInvoiceAndGetQrDataUrl(): Promise<string> {
    // Confirmed live (read-only investigation against seeded order #ORD-20260509-0003, chosen
    // because it was already "Shipped"): clicking "Print Invoice" here did not change the
    // order's status. The expectStatus('Shipped') check run immediately afterward did NOT
    // pass — it errored with a Playwright strict-mode violation (getByText('Shipped',
    // {exact:true}) matched 2 elements: the status-history entry and the status-combobox's own
    // label, both reading "Shipped" — a pre-existing bug in expectStatus(), not something this
    // change introduced or fixed). That specific failure mode — 2 matches, both still reading
    // "Shipped", rather than 0 matches or a different status text — is the actual evidence that
    // the click didn't mutate the order's status. (print-status.spec.ts has a test asserting
    // this same no-op behavior in general, but that test has never run past placeOrder() in
    // this repo — it's unexecuted plan-authored test code, not something proven by a passing
    // run, so it isn't cited here as corroborating evidence.)
    //
    // Clicking "Print Invoice" does NOT call window.print() on the admin app's own page. Instead
    // it synchronously injects a hidden <iframe> containing the fully-built printable invoice
    // HTML (a floating "Print" button inside THAT iframe is what calls window.print() on the
    // iframe's own contentWindow — confirmed via DOM inspection of the injected HTML — but we
    // never need to click it, since the QR image already exists in the iframe's DOM as soon as
    // it's inserted). The QR itself is a plain
    // `<img alt="Order QR" src="data:image/png;base64,...">` in the iframe's header band.
    //
    // Critically, that iframe is short-lived: confirmed live it gets removed again within
    // roughly 1-1.5s of insertion (presumably once the print flow it exists to feed has settled).
    // A Playwright locator/frameLocator-based wait is too slow to reliably catch it — confirmed
    // live via `page.frameLocator('iframe').locator('img[alt="Order QR"]').waitFor(...)`, which
    // timed out because the iframe was already gone. A `MutationObserver` installed BEFORE the
    // click, capturing the <img> synchronously as part of the iframe's insertion, is what
    // actually works — this mirrors exactly how the live investigation captured it.
    await this.page.evaluate(() => {
      (window as any).__qrDataUrl = null;
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (!(node instanceof HTMLIFrameElement)) continue;
            const capture = () => {
              const doc = node.contentDocument;
              const img = doc?.querySelector('img[alt="Order QR"]') as HTMLImageElement | null;
              if (img && !(window as any).__qrDataUrl) {
                (window as any).__qrDataUrl = img.src;
              }
            };
            // Capture immediately (confirmed live: the iframe's content is already present at
            // insertion time, not written asynchronously after a 'load' event) and again on
            // 'load' as a defensive fallback in case that timing ever changes.
            capture();
            node.addEventListener('load', capture);
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });

    await this.printInvoice();

    await expect
      .poll(() => this.page.evaluate(() => (window as any).__qrDataUrl as string | null), {
        message: 'Timed out waiting for the print-invoice iframe to inject the Order QR <img>',
      })
      .not.toBeNull();

    return this.page.evaluate(() => (window as any).__qrDataUrl as string);
  }

  async setStatus(status: string) {
    // Confirmed live via DOM inspection (same Card structure documented in expectStatus() below):
    // the "Update Status" heading's CardHeader and the CardContent holding the actual controls are
    // sibling divs under one shared Card div, so `xpath=..` from the heading (as the brief
    // originally proposed) only reaches the CardHeader and finds nothing — `xpath=../..` is needed
    // to reach the Card that contains the controls.
    //
    // The live control is a Radix-style status <select>: a `role="combobox"` trigger button
    // (accessible name = the currently selected status, e.g. "Pending") that opens a
    // `role="listbox"` of `role="option"` items portalled to the document body (NOT nested under
    // the Card in the DOM — confirmed live, so the option click below is intentionally unscoped).
    // Also confirmed live: there is a SEPARATE "Update Status" *button* inside this same Card,
    // sharing its accessible name with the "Update Status" *heading* — scoping to the Card (rather
    // than an unscoped `getByRole('button', { name: 'Update Status' })`) keeps this unambiguous.
    // That submit button starts disabled and only becomes enabled once a different option is
    // picked; selecting an option alone does not persist the change, so the button click below is
    // required (confirmed live: status only actually updates, and the Timeline gains a new entry,
    // after clicking it).
    const card = this.page.getByRole('heading', { name: 'Update Status' }).locator('xpath=../..');
    await card.getByRole('combobox').click();
    await this.page.getByRole('option', { name: status, exact: true }).click();
    // Wait for the status change to actually persist before returning, rather than firing the
    // click and moving straight on -- callers (print-status.spec.ts) chain a `printInvoice()`
    // right after this, and without this wait that click could race the still-in-flight PATCH.
    // The exact endpoint was never clicked-and-observed live (doing so mutates the seeded order's
    // real status, which is off-limits for read-only investigation), so this matches broadly on
    // method + the orders API base path rather than an unconfirmed exact URL -- consistent with
    // the URL-substring-matching convention already used by `searchAndOpen()` and `addItem()`.
    const statusSettled = this.page.waitForResponse(
      (response) => response.url().includes('/api/st/orders/') && response.request().method() === 'PATCH',
    );
    await card.getByRole('button', { name: 'Update Status' }).click();
    await statusSettled;
  }

  async expectStatus(status: string) {
    // Confirmed live: the "Update Status" card renders as
    // <div class="rounded-xl ..."><div><h3>Update Status</h3></div><div>...<p>{status}</p><p>Current
    // Status</p>...</div></div> — the CardHeader (holding the heading) and the CardContent
    // (holding the status value + "Current Status" label) are sibling divs, both children of
    // the outer Card div. Going up only one level (`xpath=..`) from the heading lands on the
    // CardHeader div, which does NOT contain the status text — verified live via DOM
    // inspection (the brief's original `xpath=..` was one level short). `xpath=../..` reaches
    // the shared Card wrapper that contains both.
    //
    // KNOWN BUG, NOW FIXED: an unscoped `card.getByText(status, {exact:true})` matches 2
    // elements for some status values -- the status-value `<p>` AND the status combobox's own
    // trigger `<span>` (its accessible label mirrors the current status, e.g. `<button
    // role="combobox">...<span>Shipped</span>...</button>`), both live inside this same Card,
    // both children of `xpath=../..`, but NOT siblings of each other. Confirmed live via DOM
    // inspection of order #ORD-20260509-0003 ("Shipped"): the exact live structure is
    // `<div class="flex items-center gap-3 ..."><div><svg/></div><div><p class="font-medium">
    // Shipped</p><p class="text-xs ...">Current Status</p></div></div>` -- the status-value `<p>`
    // and the "Current Status" label `<p>` are direct siblings of each other, while the combobox
    // trigger lives in a completely separate sibling `<div class="space-y-3">` further down the
    // same Card. Anchoring off "Current Status" and walking to its immediate preceding sibling
    // `<p>` reaches only the status value, and can never also match the combobox trigger (which
    // isn't a sibling of "Current Status" at all).
    const card = this.page.getByRole('heading', { name: 'Update Status' }).locator('xpath=../..');
    const statusValue = card
      .getByText('Current Status', { exact: true })
      .locator('xpath=preceding-sibling::p[1]');
    // A generous explicit timeout (default is 5000ms): this resolves through two chained
    // locators (the "Current Status" label, then its preceding sibling) instead of one, and a
    // full parallel `npx playwright test` run of this whole suite was observed to occasionally
    // exceed the 5s default here under heavy concurrent load against the shared test backend
    // (10/10 reruns passed comfortably within ~1s each in isolation, confirming this is a
    // load/timing margin issue, not a locator-correctness issue).
    await expect(statusValue).toHaveText(status, { timeout: 10000 });
  }

  async expectNoConsoleErrors(errors: string[]) {
    expect(errors, `Unexpected console errors on order detail page: ${errors.join('; ')}`).toEqual([]);
  }

  async expectCustomerName(name: string) {
    // Scoped to the "Customer Information" Card (same single-level `xpath=../..` climb
    // documented in editCustomerInfo() below) rather than an unscoped page-wide `getByText()` --
    // the "Shipping Address" section also renders a person's name (the shipping recipient), so an
    // unscoped substring match risks a Playwright strict-mode violation (or a false pass) if both
    // sections ever happen to render the same text.
    const card = this.page.getByRole('heading', { name: 'Customer Information' }).locator('xpath=../..');
    await expect(card.getByText(name)).toBeVisible();
  }

  async expectCustomerEmail(email: string) {
    // Scoped to "Customer Information", and matched via the `role="link"` (`mailto:`) rendering
    // of the email rather than a plain text match -- confirmed live the email renders as
    // `<a href="mailto:...">`, so its accessible name is exactly the email text.
    const card = this.page.getByRole('heading', { name: 'Customer Information' }).locator('xpath=../..');
    await expect(card.getByRole('link', { name: email })).toBeVisible();
  }

  async expectCustomerPhone(phone: string) {
    // Scoped to "Customer Information", matched via its `role="link"` (`tel:`) rendering, same
    // discipline as expectCustomerEmail() above. Scoping matters even more here than for the
    // name/email: confirmed live the "Shipping Address" section renders its OWN phone number too
    // (the shipping recipient's), which for a fresh order can be the same customer/phone -- an
    // unscoped match risks exactly the strict-mode collision this whole finding is about.
    const card = this.page.getByRole('heading', { name: 'Customer Information' }).locator('xpath=../..');
    await expect(card.getByRole('link', { name: phone })).toBeVisible();
  }

  async expectShippingStreet(street: string) {
    // Scoped to the "Shipping Address" Card for the same reason as expectCustomerName() above --
    // keeps this immune to any other section of the page that might ever render overlapping text.
    const card = this.page.getByRole('heading', { name: 'Shipping Address' }).locator('xpath=../..');
    await expect(card.getByText(street)).toBeVisible();
  }

  async editCustomerInfo(details: { firstName: string; lastName: string; email?: string; phone?: string }) {
    // Confirmed live via read-only investigation against seeded order #ORD-20260509-0003
    // (opened the modal to inspect its fields, then closed it via the dialog's "Close" (X)
    // button WITHOUT saving — confirmed via `[data-state]` on the dialog and the live network
    // log showing no PATCH/POST fired — no change was persisted against seeded data).
    //
    // The pencil button next to the "Customer Information" heading has no accessible name
    // (icon-only). Confirmed live via DOM inspection: the heading and its pencil button are
    // the only two children of a shared header div (`<div class="... flex flex-row items-center
    // justify-between ...">`) — that div has exactly one `<button>` in it (the "Resend
    // Confirmation" button lives in a sibling content div, not here), so `xpath=..` from the
    // heading followed by an unscoped `getByRole('button')` reaches the pencil button
    // unambiguously, same as the brief's starting point.
    //
    // The resulting modal is titled "Edit customer" — and, unlike the checkout form (which the
    // brief guessed this would mirror), it does NOT split first/last name: it has a single
    // combined "Name" field (confirmed live: `<input id="cust_name">` labeled "Name", prefilled
    // with the full name e.g. "Abdollah Mourad"), plus "Email" ("cust_email", type=email) and
    // "Phone" ("cust_phone") fields — both confirmed live (read-only DOM inspection, values never
    // changed/saved) to be plain editable inputs, not readonly/disabled, so both are safe to
    // extend this method to fill. `email`/`phone` are optional so existing callers that only care
    // about the name don't need updating. Combining firstName + lastName into that one field is
    // what makes the spec's `getByText('Updated Name')` assertion match after a real save.
    await this.page
      .getByRole('heading', { name: 'Customer Information' })
      .locator('xpath=..')
      .getByRole('button')
      .click();
    const dialog = this.page.getByRole('dialog', { name: 'Edit customer' });
    await dialog.getByLabel('Name', { exact: true }).fill(`${details.firstName} ${details.lastName}`);
    if (details.email !== undefined) {
      await dialog.getByLabel('Email', { exact: true }).fill(details.email);
    }
    if (details.phone !== undefined) {
      await dialog.getByLabel('Phone', { exact: true }).fill(details.phone);
    }
    await dialog.getByRole('button', { name: 'Save' }).click();
    // Wait for the save to actually persist (dialog closing is the on-screen signal the Radix
    // dialog uses for a completed action, confirmed live via its `data-state` flipping from
    // "open" to "closed") before returning, instead of firing the click and moving straight on —
    // the caller (edit-customer-address.spec.ts) calls `adminPage.reload()` right after this, and
    // reloading while the underlying PATCH is still in flight can abort the request.
    await expect(dialog).toBeHidden();
  }

  async addItem(details: { productName: string; quantity: number; unitPrice: number }) {
    // Confirmed live via read-only investigation against seeded order #ORD-20260509-0003
    // (opened "Add item", typed a real product name into the search box, selected the
    // resulting product to reveal the Quantity/Unit price fields, then closed the dialog via
    // its "Close" (X) button WITHOUT clicking the dialog's own "Add item" submit button —
    // confirmed via the dialog's `data-state` flipping to "closed" and the live network log
    // for the whole investigation containing only GET requests, no POST/PATCH/DELETE — no item
    // was added to the seeded order).
    //
    // The trigger is the page-level `getByRole('button', { name: 'Add item' })` above "Order
    // Items", opening a dialog titled "Add item to order" (subtitle: "Search for a product,
    // then enter quantity and price."). It's a two-step flow:
    //  1. A `getByPlaceholder('Search by name or SKU...')` textbox filters a list of unlabeled
    //     product buttons (name + price). Confirmed live this search is server-backed, not a
    //     client-side filter of an already-fetched list: typing "Siren" fired
    //     `GET /api/st/products?search=Siren&pageSize=30` and only then did the button list
    //     narrow to the single matching product — so, like
    //     `AdminOrdersListPage.searchAndOpen()`'s debounced order search, this waits for that
    //     response before clicking a result to avoid a race against the still-unfiltered list.
    //  2. Clicking a product button replaces the search UI with a "Quantity" number input
    //     (prefilled "1") and a "Unit price (KWD)" number input (prefilled from the product's
    //     own price), plus a "Change" button to go back to the product list.
    // The dialog's OWN submit button is also named "Add item" (same accessible name as the
    // trigger button on the page behind it), so it's scoped to `dialog` below to stay
    // unambiguous — same discipline as `editCustomerInfo()`/`editShippingAddress()`'s dialog
    // scoping.
    await this.page.getByRole('button', { name: 'Add item' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Add item to order' });
    const searchSettled = this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/st/products') &&
        response.url().includes(`search=${encodeURIComponent(details.productName)}`),
    );
    await dialog.getByPlaceholder('Search by name or SKU...').fill(details.productName);
    await searchSettled;
    // Plain-string `name` does a case-insensitive substring match (unlike a `RegExp`, this
    // needs no escaping for product names containing regex-special characters, e.g. "ACUVUE
    // OASYS for Astigmatism (6 Pack)").
    await dialog.getByRole('button', { name: details.productName }).first().click();
    await dialog.getByLabel('Quantity').fill(String(details.quantity));
    await dialog.getByLabel('Unit price (KWD)').fill(String(details.unitPrice));
    await dialog.getByRole('button', { name: 'Add item', exact: true }).click();
    // Wait for the dialog to actually close (its Radix `data-state` flips to "closed" once the
    // submit succeeds, same signal used elsewhere on this page) before returning, rather than
    // firing the click and moving straight on to whatever the caller does next (e.g. reading
    // totals/item count, which would race the still-in-flight POST otherwise).
    await expect(dialog).toBeHidden();
  }

  async deleteItem(index: number) {
    // Confirmed live against seeded order #ORD-20260509-0003 (read-only: inspected the
    // accessible-name computation via the accessibility tree, never clicked): each line item
    // under "Order Items" renders an icon-only "Edit" button and an icon-only "Delete" button
    // (no visible text in the DOM — `button.textContent` is empty for both — but each resolves
    // an accessible name of "Edit"/"Delete" respectively, e.g. via visually-hidden label text or
    // an SVG `<title>`, which is exactly what `getByRole('button', { name: 'Delete' })` matches
    // on). This confirms the brief's proposed locator is correct as-is; not changed from the
    // brief's stub.
    const before = await this.getItemCount();
    await this.page.getByRole('button', { name: 'Delete' }).nth(index).click();
    // Wait for the item to actually disappear from the DOM before returning -- firing the click
    // and immediately letting the caller call `getItemCount()` races the DOM update (and any
    // in-flight DELETE request) instead of observing the real post-delete state.
    await expect
      .poll(() => this.getItemCount(), {
        message: 'Timed out waiting for the deleted line item to disappear from the DOM',
      })
      .toBe(before - 1);
  }

  async getItemCount(): Promise<number> {
    return this.page.getByRole('button', { name: 'Delete' }).count();
  }

  async editItem(index: number, updates: { quantity?: number; unitPrice?: number }) {
    // Live investigation (read-only, seeded order #ORD-20260509-0003; clicked "Edit" to inspect,
    // then clicked the inline "Cancel" (X) control to back out -- confirmed via the live network
    // log containing only cached GETs, no PATCH/POST/DELETE, that nothing was persisted).
    //
    // Unlike Add item / Edit customer / Edit shipping address (each of which opens a
    // `role="dialog"` modal), a line item's own "Edit" button does NOT open a dialog. It swaps
    // that row's price text (`<p>KWD 44.000</p>`) in place for two unlabeled
    // `<input type="number">` fields -- Quantity first (prefilled with the current quantity),
    // Unit price second (prefilled with the current unit price, confirmed live via DOM order) --
    // plus two icon-only buttons that, unlike the row's own "Edit"/"Delete" buttons (which
    // resolve accessible names "Edit"/"Delete" via a `title` attribute), have NO accessible name
    // at all: no `title`, no `aria-label`, no visible text, and their inner `<svg>` has no
    // `<title>` child either (confirmed live via full attribute-list inspection) -- a genuine
    // accessibility gap, not a locator mistake; see the new row added to docs/testid-requests.md.
    // The only stable hook is each Lucide icon's own CSS class (`lucide-save` / `lucide-x`).
    //
    // No power/SPH/CYL/AXIS editing fields appear anywhere in this inline editor -- only
    // Quantity and Unit price are live-confirmed editable here, so this method intentionally
    // only supports those two (matching what the real UI actually exposes, rather than a
    // guessed-at field that doesn't exist).
    //
    // The Save button was never clicked live (doing so would mutate seeded order
    // #ORD-20260509-0003's real items, which read-only investigation must not do), so the real
    // persistence endpoint/response shape was never observed. Rather than guess an unconfirmed
    // API URL for a `waitForResponse`, this waits for the row to actually leave edit mode (its
    // number inputs disappear, replaced by the static price text again) as the persistence
    // signal -- the same "wait for a real signal, not just the click" discipline used by every
    // other mutating method on this page, applied to the signal that's actually available here.
    //
    // The row is scoped by its own structural wrapper div, NOT by chaining through the "Edit"
    // button's accessible name -- clicking "Edit" makes that same button's name disappear
    // (replaced by the unnamed Save/Cancel pair), so re-resolving a later action through a
    // `getByRole('button', {name:'Edit'}).nth(index)` chain after the click would silently
    // re-target a different row (indices shift as the clicked row drops out of the "Edit"-named
    // set) or throw if this was the last row. The row wrapper itself stays structurally present
    // and in the same position throughout the edit, so scoping to it first keeps every
    // subsequent action correctly targeted at the same row.
    //
    // Confirmed live: unlike "Update Status"/"Customer Information" (where the heading's direct
    // parent IS the CardHeader), "Order Items"'s heading sits in its own wrapper div alongside
    // the item count `<p>` (`<div><h3>Order Items</h3><p>2 items</p></div>`), because its
    // CardHeader is a flex row that also holds the "Add item" button as a sibling of that
    // wrapper -- so reaching the outer Card here takes 3 `..` hops from the heading, not 2.
    // The row wrapper's full live class list is `flex items-center gap-4 p-3 rounded-lg border`;
    // the shorter `div.rounded-lg.border` alone is NOT unique -- each row's own product-thumbnail
    // div (`h-16 w-16 rounded-lg border overflow-hidden bg-muted`) also carries both of those
    // classes and is nested inside the row, which would throw off `.nth(index)` indexing. Matching
    // the full class list avoids that collision.
    const itemsCard = this.page.getByRole('heading', { name: 'Order Items' }).locator('xpath=../../..');
    const row = itemsCard.locator('div.flex.items-center.gap-4.p-3.rounded-lg.border').nth(index);
    await row.getByRole('button', { name: 'Edit' }).click();

    const quantityInput = row.locator('input[type="number"]').nth(0);
    const unitPriceInput = row.locator('input[type="number"]').nth(1);
    if (updates.quantity !== undefined) {
      await quantityInput.fill(String(updates.quantity));
    }
    if (updates.unitPrice !== undefined) {
      await unitPriceInput.fill(String(updates.unitPrice));
    }
    await row.locator('button:has(svg.lucide-save)').click();
    await expect(quantityInput).toBeHidden();
  }

  async editShippingAddress(details: { street: string; city: string }) {
    // Confirmed live via the same read-only investigation and the same discipline: opened the
    // modal against seeded order #ORD-20260509-0003 to inspect its fields, closed it via the
    // "Close" (X) button without saving, confirmed no PATCH/POST fired.
    //
    // The pencil button next to "Shipping Address" is likewise icon-only with no accessible
    // name, and sits in the same header-div structure as Customer Information's (heading +
    // exactly one button, confirmed live) — same `xpath=..` + unscoped `getByRole('button')`
    // shape as the brief's starting point.
    //
    // The resulting modal is titled "Edit shipping address". Confirmed live via DOM inspection
    // of its inputs and their `<label for>` associations: "First name", "Last name", "Phone",
    // "Address line 1", "Address line 2", "City", "Area / Governorate", "Postal code", "Country
    // code" — NOT "Street Address *"/"City *" like the checkout form's placeholders (the brief's
    // guess). "Address line 1" is the street field; "City" matches directly.
    await this.page
      .getByRole('heading', { name: 'Shipping Address' })
      .locator('xpath=..')
      .getByRole('button')
      .click();
    const dialog = this.page.getByRole('dialog', { name: 'Edit shipping address' });
    await dialog.getByLabel('Address line 1').fill(details.street);
    await dialog.getByLabel('City', { exact: true }).fill(details.city);
    await dialog.getByRole('button', { name: 'Save' }).click();
    // Wait for the save to actually persist (dialog closing, same `data-state` signal as
    // editCustomerInfo() above) before returning. This is the worst instance of the
    // fire-and-move-on problem across this file: the caller (edit-customer-address.spec.ts)
    // calls `adminPage.reload()` immediately after this, and a reload while the address PATCH is
    // still in flight can abort the request outright, losing the edit instead of just racing a
    // read of it.
    await expect(dialog).toBeHidden();
  }

  async getSubtotal(): Promise<string> {
    return this.getOrderSummaryRow('Subtotal');
  }

  async getTotal(): Promise<string> {
    return this.getOrderSummaryRow('Total');
  }

  private async getOrderSummaryRow(label: 'Subtotal' | 'Total'): Promise<string> {
    // Confirmed live via read-only DOM inspection against seeded order #ORD-20260509-0003: the
    // "Order Summary" card uses the same CardHeader/CardContent-siblings-under-one-Card structure
    // as "Update Status" above, so the same `xpath=../..` climb from the heading is used to
    // scope to it. The live DOM is
    // `<div class="flex justify-between ..."><span class="text-muted-foreground">Subtotal</span>
    // <span>KWD&nbsp;62.000</span></div>` (and similarly for the "Total" row, one level deeper
    // inside a `border-t` wrapper) -- the label and its value are plain sibling `<span>`s, so
    // walking from the exact-text label span to its immediate following sibling reaches the
    // value. Scoping to "Order Summary" specifically matters: the separate "Payment Method"
    // section elsewhere on the page also renders its own "Subtotal"/"Total" rows, but in a
    // different text format (`62.000 KWD`, KWD suffixed rather than prefixed) -- an unscoped
    // locator could read the wrong one.
    const card = this.page.getByRole('heading', { name: 'Order Summary' }).locator('xpath=../..');
    const value = card.getByText(label, { exact: true }).locator('xpath=following-sibling::span[1]');
    return ((await value.textContent()) ?? '').trim();
  }
}
