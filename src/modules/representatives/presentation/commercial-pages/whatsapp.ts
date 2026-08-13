/**
 * Pure WhatsApp-link helpers shared by every per-product commercial page —
 * not a "shared component" that renders markup (that was the whole problem
 * with the old `WhatsappCta`, which forced every product through one Button
 * variant), just the URL/tracking logic every template's own inline script
 * duplicated verbatim seven times. Each product page still writes its own
 * literal `<a className={styles.btnWhats}>` markup matching its template.
 */

/**
 * `wa.me` expects digits only, with country code, no `+`/spaces/punctuation.
 * `phone` isn't constrained to any particular shape at the schema level, so
 * this normalizes whatever was stored, assuming Brazil (+55).
 */
function toWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export function buildWhatsappHref(phone: string, message: string): string {
  return `https://wa.me/${toWhatsAppDigits(phone)}?text=${encodeURIComponent(message)}`;
}

/**
 * AN5 (docs/QR_ANALYTICS_PLAN.md §3.3/§4) — best-effort click tracking, same
 * internal pipeline every product already reports through (not the
 * templates' own GA4 `gtag` calls, which this Next.js app replaced
 * end-to-end). No `preventDefault`: the browser's own navigation to `wa.me`
 * proceeds regardless of whether this fetch ever completes.
 */
export function trackWhatsappClick(productSlug: string) {
  fetch('/api/track-click', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productSlug, referrer: document.referrer || null }),
  }).catch(() => {
    // Best-effort — a failed beacon must never surface to the visitor.
  });
}
