import { Page, expect } from '@playwright/test';

export class AdminOrderDetailPage {
  constructor(private page: Page) {}

  async printInvoice() {
    await this.page.getByRole('button', { name: 'Print Invoice' }).click();
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
