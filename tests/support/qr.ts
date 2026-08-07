import { PNG } from 'pngjs';
import jsQR from 'jsqr';

// Confirmed live (read-only investigation against seeded order #ORD-20260509-0003 in the admin
// panel — see qr-code.spec.ts for how the data URL is captured): the print-invoice QR renders as
// a plain <img alt="Order QR" src="data:image/png;base64,..."> inside a hidden, short-lived
// <iframe> that the "Print Invoice" button injects into the admin page (used to build the
// printable HTML; it disappears again within ~1-1.5s, which is why the caller has to capture the
// src via a MutationObserver rather than a Playwright locator — the iframe is long gone by the
// time a locator-based wait would resolve). PNG, not any other raster format — confirmed via the
// data URL's own `image/png` MIME segment.

/**
 * Decodes the QR code embedded in a `data:image/png;base64,...` data URL and returns the string
 * it encodes (or null if jsQR can't locate a QR code in the image).
 *
 * Uses `pngjs` to turn the PNG bytes into raw RGBA pixel data — pngjs's sync reader always
 * normalizes decoded pixels to 4-byte-per-pixel RGBA regardless of the source PNG's color type,
 * which is exactly the format `jsQR(data, width, height)` expects.
 */
export function decodeQrFromPngDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    throw new Error(`decodeQrFromPngDataUrl: expected a data:image/png;base64,... URL, got: ${dataUrl.slice(0, 60)}...`);
  }
  const png = PNG.sync.read(Buffer.from(match[1], 'base64'));
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return code ? code.data : null;
}
