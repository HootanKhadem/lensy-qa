import { Page, expect } from '@playwright/test';
import { env } from '../support/env';

export class AdminProductFormPage {
  constructor(private page: Page) {}

  async expectLoaded() {
    // `exact: true` matches save()'s own matcher below (the Save button's text stays "Save"
    // while idle and only changes while a save is in-flight, but keeping both matchers in sync
    // avoids the two silently drifting apart).
    await expect(this.page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  }

  async save() {
    // The Save button is disabled while the mutation is in-flight (`isSaving`). Wait for
    // the persistence to complete before returning, rather than just firing the click and
    // moving on — prevents callers from immediately doing `await adminPage.reload()` while
    // the PATCH is still in-flight (which would abort the request and lose the mutation).
    // Wait for the save API response to settle before returning. Confirmed live: the save
    // endpoint is a PATCH to Supabase REST API at `/rest/v1/st_products`.
    const saveSettled = this.page.waitForResponse(
      (response) => response.url().includes('/rest/v1/st_products') && response.request().method() === 'PATCH',
    );
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    const response = await saveSettled;
    // `waitForResponse` matches on URL/method alone, so a 4xx/5xx response looks identical to a
    // successful one to every caller unless this checks the status too.
    expect(response.ok(), `Save PATCH to ${response.url()} returned ${response.status()}`).toBeTruthy();
  }

  // Confirmed live (see README.md's "Known Environment Bugs"): clicking Save unconditionally
  // clears the product's category (`category_ids`/`category_id` both come back empty) even on a
  // save that never touched the Category widget at all -- reproduced repeatedly against real
  // products via the API response, not just the UI. The only way found to make a category
  // survive a save is to actually toggle its checkbox off then back on during this same page
  // session immediately before clicking Save (merely having it already checked on page load
  // isn't enough), and even that isn't fully reliable -- it can still occasionally not stick.
  // Hoisted here (originally written only inside toric-preorder-storefront.spec.ts, now renamed
  // preorder-storefront.spec.ts) so every products-inventory spec that saves a product with a
  // real category gets the same defense instead of a bare `save()` silently wiping it -- see C1
  // in this sub-project's final whole-branch review.
  //
  // Callers must pass the exact visible name of ONE of the product's own category checkboxes
  // (e.g. "Sun Glasses") -- this only re-affirms that single category, it doesn't discover or
  // restore a product's full category set on its own.
  async saveReaffirmingCategory(categoryName: string) {
    const editUrl = this.page.url();
    const productIdMatch = editUrl.match(/\/products\/([^/]+)\/edit/);
    if (!productIdMatch) throw new Error(`Could not extract product id from edit URL: ${editUrl}`);
    const productApiUrl = new URL(`api/st/products/${productIdMatch[1]}`, env.adminUrl()).toString();
    const categoryCheckbox = this.page.getByRole('checkbox', { name: categoryName, exact: true });

    const reaffirm = async () => {
      await expect(categoryCheckbox).toHaveAttribute('aria-checked', 'true');
      // Whatever underlying form-state library backs this form appears to only include a field
      // in its submitted payload once the user has "touched" it, not merely because its current
      // value happens to already be correct -- so this always toggles off-then-on (dirtying it)
      // rather than skipping when it's already checked.
      await categoryCheckbox.click();
      await expect(categoryCheckbox).toHaveAttribute('aria-checked', 'false');
      // A short settle delay between the two clicks and before returning: confirmed live that
      // this toggle can still lose the race and get excluded from the very next Save's payload
      // even though both clicks land and both intermediate `aria-checked` assertions pass -- the
      // visual state is correct but whatever debounced form-state sync feeds the actual submit
      // hasn't caught up yet. There's no real event to wait on here (no network request fires
      // for a local checkbox toggle), so this is a pragmatic delay, not a proper signal.
      await this.page.waitForTimeout(300);
      await categoryCheckbox.click();
      await expect(categoryCheckbox).toHaveAttribute('aria-checked', 'true');
      await this.page.waitForTimeout(300);
    };

    // Confirmed live that even the toggle-dirty trick above doesn't make the category survive
    // Save with full reliability -- across repeated real runs it can still occasionally come
    // back empty, for reasons that couldn't be pinned down further as a black box (no app source
    // available for this specific propagation quirk). Rather than ship a fix that "usually"
    // avoids further damaging the product's category, this verifies the actual persisted result
    // against the API directly and retries the whole thing (fresh navigation included) up to 3
    // times, only giving up with a hard failure if the category genuinely won't stick.
    let categoryPersisted = false;
    for (let attempt = 1; attempt <= 3 && !categoryPersisted; attempt++) {
      if (attempt > 1) {
        await this.page.goto(editUrl);
        await this.expectLoaded();
      }
      await reaffirm();
      await this.save();

      // A short settle delay before reading back: confirmed live that an immediate GET right
      // after save()'s PATCH resolves can still read stale (empty) category_ids even when the
      // save actually did persist the category correctly -- this app is served from Cloudflare
      // Workers, and the mismatch is consistent with edge-cache propagation lag on the read path
      // rather than the write itself failing. Without this delay the loop can burn through all 3
      // attempts (and their real Save calls) chasing a false negative instead of confirming a
      // write that already succeeded.
      await this.page.waitForTimeout(500);
      const response = await this.page.request.get(productApiUrl);
      const body: { data?: { category_ids?: string[] } } = await response.json();
      categoryPersisted = Array.isArray(body.data?.category_ids) && body.data.category_ids.length > 0;
    }
    expect(categoryPersisted, 'category_ids came back empty after save, even after 3 attempts').toBe(true);
  }

  async getExpiryDate(): Promise<string> {
    return this.page.getByLabel('Expiry Date').inputValue();
  }

  async setExpiryDate(date: string) {
    await this.page.getByLabel('Expiry Date').fill(date);
  }

  async getSupplierStock(): Promise<number> {
    // Confirmed live: this is a `type="number"` input, and the backing column always renders a
    // real numeric value once the form has loaded from the server (it defaults to 0, never
    // null/blank) -- so `parseInt(value, 10) || 0` never actually collapses a legitimately-empty
    // field into a false "0" here; it only guards against a genuinely unparseable string, which
    // shouldn't occur in practice for this field.
    const value = await this.page.getByLabel('Supplier stock').inputValue();
    return parseInt(value, 10) || 0;
  }

  async setSupplierStock(qty: number) {
    await this.page.getByLabel('Supplier stock').fill(String(qty));
  }

  async getLinkedSupplier(): Promise<string> {
    // Confirmed live: this combobox's own placeholder/default option is a real, selectable
    // "No supplier" entry, not a blank/empty state -- so this never actually returns `''` for a
    // product with nothing linked (the `|| ''` fallback only guards a genuinely missing element).
    return (await this.page.getByLabel('Linked supplier').textContent())?.trim() || '';
  }

  async setLinkedSupplier(name: string) {
    const field = this.page.getByLabel('Linked supplier');
    await field.click();
    await this.page.getByRole('option', { name }).click();
    // Confirmed live (rarely, under this suite's normal heavy parallel load): the combobox can
    // occasionally still show its previous value for a moment right after the option click
    // resolves, and a `save()` fired before the local selection state has actually updated omits
    // it from the payload -- the same "form only submits a field once its state has genuinely
    // changed" family of issue documented for the category checkbox in README.md. Waiting for
    // the field's own displayed text to reflect the selection before returning closes that race
    // for callers that save() immediately after this.
    await expect(field).toHaveText(name);
  }

  async getAllowPreOrder(): Promise<boolean> {
    return (await this.page.getByLabel('Allow pre-order').getAttribute('aria-checked')) === 'true';
  }

  async setAllowPreOrder(enabled: boolean) {
    const toggle = this.page.getByLabel('Allow pre-order');
    const checked = await toggle.getAttribute('aria-checked');
    if ((checked === 'true') !== enabled) {
      await toggle.click();
    }
  }

  async setPreOrderEstimatedArrival(text: string) {
    await this.page.getByLabel('Estimated arrival').fill(text);
  }

  async getPreOrderEstimatedArrival(): Promise<string> {
    return this.page.getByLabel('Estimated arrival').inputValue();
  }

  // Confirmed live (full accessibility-tree dump): unlike most switches on this form (e.g.
  // "Allow pre-order", which resolves via `getByLabel`), the "Contact Lens" and "Toric /
  // Astigmatism" toggles render as bare, unlabeled switches -- no `aria-label`, no `<label for>`,
  // and the adjacent heading/paragraph text isn't wired up via `aria-labelledby` -- so
  // `getByLabel` finds nothing for either one. This is a real accessibility gap (see
  // docs/testid-requests.md), not a selector mistake.
  //
  // Scoping this correctly took more than the simple `.filter({ has }).last()` trick
  // toricSection() below uses: a bare "contains the Contact Lens heading" filter matches 8
  // nested ancestor divs on this page (confirmed live), and neither `.first()` (too broad --
  // also contains the unrelated "Eyeglasses" card and its own switches) nor `.last()` (too
  // narrow -- only the Contact Lens toggle's own tight header wrapper, missing the Toric toggle
  // entirely) lands on the right one. Requiring the container to ALSO contain the "Toric Stock
  // Combinations" heading, while explicitly excluding one that also contains the "Eyeglasses"
  // heading, narrows it to exactly one match: the Contact Lens card itself, holding exactly its
  // own 2 switches in a confirmed-live, stable order: index 0 = "Contact Lens", index 1 =
  // "Toric / Astigmatism".
  private contactLensSection() {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByRole('heading', { name: 'Contact Lens', exact: true }) })
      .filter({ has: this.page.getByRole('heading', { name: 'Toric Stock Combinations', exact: true }) })
      .filter({ hasNot: this.page.getByRole('heading', { name: 'Eyeglasses', exact: true }) })
      .first();
  }

  // Returns the locator itself (rather than a resolved boolean) so callers can use Playwright's
  // own auto-retrying `expect(...).toHaveAttribute(...)` -- this section can take several
  // seconds to hydrate after the rest of the form has already loaded (a separate, later data
  // fetch populates the Contact Lens/toric flags), so a one-shot read risks a false negative.
  toricSwitch() {
    return this.contactLensSection().getByRole('switch').nth(1);
  }

  // Scoped to the Contact Lens card's own toric sub-section (identified by its "Toric Stock
  // Combinations" heading) rather than the whole page. `.last()` on this filter resolves to the
  // innermost matching ancestor (document order lists a parent before its own children), which
  // is confirmed live to hold exactly the add-combination controls and the table beneath them --
  // not the outer Contact Lens toggle/description, and not any other table/input elsewhere on
  // this large single-page form (e.g. the per-power "Lens Powers" table, or a "Qty"/"Add" control
  // some other section could introduce later). This closes the latent strict-mode-violation risk
  // the previous unscoped `getByPlaceholder('Qty')`/`getByRole('button', { name: 'Add' })` calls
  // carried (see I8 in this sub-project's final whole-branch review).
  private toricSection() {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByRole('heading', { name: 'Toric Stock Combinations', exact: true }) })
      .last();
  }

  private toricTable() {
    return this.toricSection().locator('table').filter({ hasText: 'AXIS' });
  }

  // Confirmed live: adding a toric entry only mutates the form's local React state (a row
  // appended to the "Toric Stock Combinations" table) -- no network request fires until the
  // page's own Save button is clicked. Unlike save(), this doesn't need a waitForResponse guard;
  // persistence is entirely handled by the existing save()'s PATCH wait.
  async addToricEntry(entry: { sphere: string; cylinder: string; axis: string; qty: number }) {
    const section = this.toricSection();
    await section.locator('select').filter({ hasText: 'Sphere (SPH)' }).selectOption({ label: entry.sphere });
    await section.locator('select').filter({ hasText: 'Cylinder (CYL)' }).selectOption({ label: entry.cylinder });
    await section.locator('select').filter({ hasText: 'Axis (AXIS)' }).selectOption({ label: entry.axis });
    await section.getByPlaceholder('Qty').fill(String(entry.qty));
    await section.getByRole('button', { name: 'Add', exact: true }).click();
  }

  async getToricEntryCount(): Promise<number> {
    return this.toricTable().locator('tbody tr').count();
  }

  // Confirmed live AND via lensyadmin source (`src/app/api/le/product-toric-stock/route.ts`):
  // this form's Save button only ever POSTs a bulk *upsert* of the toric entries still present
  // in local state -- it never calls the sibling per-entry `DELETE /api/le/product-toric-stock/
  // [id]` route (also present in source) for a combination removed from the UI's local list. So
  // removing a row in this form and clicking Save does NOT delete it server-side: the row
  // disappears from the table immediately (and the Save payload correctly omits it) but the
  // previously-persisted database row is never actually deleted, and reappears on the next
  // reload. This is a real, confirmed environment bug -- see README.md's "Known Environment
  // Bugs". The only way to actually remove a persisted toric entry is to call the per-entry
  // DELETE route directly, which is what this does, bypassing the form's (non-functional for
  // this purpose) delete-row-then-Save UI flow entirely. `productId` is the product's own id
  // (from its edit URL), not read from the page itself, since the DELETE route needs it to look
  // the entry back up by its sphere/cylinder/axis values.
  async deleteToricEntryPermanently(productId: string, entry: { sphere: string; cylinder: string; axis: string }) {
    const listUrl = new URL(`api/le/product-toric-stock?productId=${productId}`, env.adminUrl()).toString();
    const listResponse = await this.page.request.get(listUrl);
    const body: {
      data?: Array<{ id: string; sphere_value: string; cylinder_value: string; axis_value: string }>;
    } = await listResponse.json();
    const match = body.data?.find(
      (e) => e.sphere_value === entry.sphere && e.cylinder_value === entry.cylinder && e.axis_value === entry.axis,
    );
    if (!match) return; // Already gone (or never actually persisted in the first place).
    const deleteUrl = new URL(`api/le/product-toric-stock/${match.id}`, env.adminUrl()).toString();
    const deleteResponse = await this.page.request.delete(deleteUrl);
    expect(deleteResponse.ok(), `DELETE ${deleteUrl} returned ${deleteResponse.status()}`).toBeTruthy();
  }
}
