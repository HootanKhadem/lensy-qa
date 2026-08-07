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
    await card.getByRole('button', { name: 'Update Status' }).click();
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
    await expect(
      this.page
        .getByRole('heading', { name: 'Update Status' })
        .locator('xpath=../..')
        .getByText(status, { exact: true }),
    ).toBeVisible();
  }

  async expectNoConsoleErrors(errors: string[]) {
    expect(errors, `Unexpected console errors on order detail page: ${errors.join('; ')}`).toEqual([]);
  }

  async editCustomerInfo(details: { firstName: string; lastName: string }) {
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
    // with the full name e.g. "Abdollah Mourad"), plus "Email" and "Phone" fields. Combining
    // firstName + lastName into that one field is what makes the spec's
    // `getByText('Updated Name')` assertion match after a real save.
    await this.page
      .getByRole('heading', { name: 'Customer Information' })
      .locator('xpath=..')
      .getByRole('button')
      .click();
    const dialog = this.page.getByRole('dialog', { name: 'Edit customer' });
    await dialog.getByLabel('Name', { exact: true }).fill(`${details.firstName} ${details.lastName}`);
    await dialog.getByRole('button', { name: 'Save' }).click();
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
    await this.page.getByRole('button', { name: 'Delete' }).nth(index).click();
  }

  async getItemCount(): Promise<number> {
    return this.page.getByRole('button', { name: 'Delete' }).count();
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
  }
}
