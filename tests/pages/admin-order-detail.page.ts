import { Page, expect } from '@playwright/test';

export class AdminOrderDetailPage {
  constructor(private page: Page) {}

  async printInvoice() {
    await this.page.getByRole('button', { name: 'Print Invoice' }).click();
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
