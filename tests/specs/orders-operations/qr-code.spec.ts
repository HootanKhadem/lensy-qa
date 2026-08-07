import { test, expect } from '../../fixtures/roles.fixture';
import { placeOrder } from '../../flows/checkout.flow';
import { AdminOrdersListPage } from '../../pages/admin-orders-list.page';
import { AdminOrderDetailPage } from '../../pages/admin-order-detail.page';
import { decodeQrFromPngDataUrl } from '../../support/qr';

test('printed invoice QR code links to a working page', async ({ customerPage, adminPage }) => {
  const { orderNumber } = await placeOrder(customerPage);

  const list = new AdminOrdersListPage(adminPage);
  await list.goto();
  await list.searchAndOpen(orderNumber);

  const detail = new AdminOrderDetailPage(adminPage);
  const qrDataUrl = await detail.printInvoiceAndGetQrDataUrl();

  const decoded = decodeQrFromPngDataUrl(qrDataUrl);
  console.log('Decoded QR value:', decoded);
  expect(decoded, 'jsQR could not locate/decode a QR code in the print-invoice image').not.toBeNull();

  // Confirmed live (read-only investigation against seeded order #ORD-20260509-0003 — NOT this
  // freshly-placed order, since checkout can't complete; see qr-code.spec.ts's task report for
  // the full trail): the QR encodes an absolute URL of the form
  // `https://lensy.app/en/o/{order-uuid}`. Two things worth flagging for whoever picks this back
  // up once the checkout bug is fixed:
  //   1. That hostname is HARDCODED to what looks like a production domain — it is NOT derived
  //      from STOREFRONT_URL (`lensyweb-test.lensydevelopment.workers.dev` in this env). The
  //      assertion below matches the observed shape (absolute URL, `/o/<uuid>` path) rather than
  //      a fixed hostname, since that's what was actually observed.
  //   2. That exact hardcoded URL, hit live via curl during investigation, returned HTTP 200 but
  //      with a generic "Page/Resource Could Not Be Found" HTML body — a soft 404, not a working
  //      order page. The equivalent path against the *test* storefront
  //      (`${STOREFRONT_URL}/o/{uuid}`, after `/en/o/{uuid}` redirects to it) DID render a real
  //      order page. This looks like a genuine, separate bug (QR hardcodes a domain that doesn't
  //      exist for/serve this test order) — distinct from the known checkout
  //      `POST /api/payment/methods` 500 this test is currently blocked on. The assertions below
  //      test the QR's literal claim ("this URL is a working page"), so if checkout gets fixed
  //      before this domain issue does, EXPECT this test to fail here, at the response-body
  //      assertion — not spuriously, but because the QR is genuinely pointing at a dead route in
  //      this environment.
  const decodedUrl = decoded as string;
  // The comment above documents the observed shape as `https://lensy.app/en/o/{order-uuid}` --
  // note the `/en/` locale segment between the host and `/o/`. The original regex required `/o/`
  // to immediately follow the host, which could never match that documented shape. The locale
  // segment is made optional (rather than required) since it isn't confirmed whether every QR
  // includes one -- this way the assertion matches both `.../o/{uuid}` and `.../en/o/{uuid}`.
  expect(decodedUrl).toMatch(
    /^https?:\/\/[^/]+\/(?:[a-z]{2}\/)?o\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

  const response = await adminPage.request.get(decodedUrl);
  expect(response.ok(), `QR URL ${decodedUrl} responded with status ${response.status()}`).toBeTruthy();

  const body = await response.text();
  // A broad regex like /not found|404/i risks false-positiving on a legitimately-working
  // single-page app: bundler chunk names, inline route manifests, and analytics/error-tracking
  // snippets commonly contain the literal substring "404" (or generic "not found" copy in an
  // unrelated help/support link) even on pages that render correctly. The confirmed-live soft-404
  // response for this QR's hardcoded `lensy.app` domain (see comment above; verified via a
  // read-only `curl` during investigation) instead renders the specific, distinctive phrase "The
  // Page/Resource You Requested Could Not Be Found" -- anchoring on that exact observed phrase
  // (case-insensitively, to tolerate minor markup/whitespace differences) keeps this a meaningful
  // check for the known failure mode instead of a broad net that can snag unrelated HTML.
  expect(
    body,
    `QR URL ${decodedUrl} resolved to what looks like the confirmed soft-404 error page, not a working order page`,
  ).not.toMatch(/page\/resource you requested could not be found/i);
});
