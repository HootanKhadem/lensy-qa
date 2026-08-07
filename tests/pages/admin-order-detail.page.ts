import { Page, expect } from '@playwright/test';

export class AdminOrderDetailPage {
  constructor(private page: Page) {}

  async printInvoice() {
    await this.page.getByRole('button', { name: 'Print Invoice' }).click();
  }

  async printInvoiceAndGetQrDataUrl(): Promise<string> {
    // Confirmed live (read-only investigation against seeded order #ORD-20260509-0003, chosen
    // because it was already "Shipped" — per print-status.spec.ts's own "printing an
    // already-shipped order does not revert its status" test, Print Invoice is a no-op on status
    // for orders already at/beyond "Preparing", so clicking it here doesn't mutate seed data;
    // confirmed afterward via expectStatus('Shipped') still passing):
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
}
