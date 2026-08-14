import { toDataURL } from 'qrcode';

/**
 * Pure QR Code generator, extracted so both `QrCodeCard` (client, on-screen)
 * and `marketing-materials` (client or server, depending on the export
 * pipeline chosen) share one call to `qrcode` instead of duplicating it.
 * `toDataURL` is isomorphic — identical behavior in the browser or in Node,
 * so this has no runtime-specific branching.
 */
export function generateQrCodeDataUrl(url: string, options: { width?: number; margin?: number } = {}): Promise<string> {
  return toDataURL(url, { width: options.width ?? 240, margin: options.margin ?? 1 });
}
