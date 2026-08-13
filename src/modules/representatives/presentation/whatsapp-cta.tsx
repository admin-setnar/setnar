'use client';

import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { Button } from '@/shared/ui/button';

/**
 * The WhatsApp glyph, inlined verbatim from
 * `templates/commercial-pages/ConexaoGreen/index.html`'s `.btn-whats svg` —
 * a generic `MessageCircle` icon reads as "chat", not specifically
 * WhatsApp, which is the whole point of this CTA's recognizability.
 */
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path d="M17.47 14.38c-.29-.15-1.71-.85-1.98-.94-.27-.1-.46-.15-.66.15-.2.29-.76.94-.93 1.13-.17.2-.34.22-.63.07-.29-.15-1.22-.45-2.32-1.43-.86-.77-1.44-1.71-1.61-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.5-.66-.5-.17 0-.37-.02-.56-.02-.2 0-.51.07-.78.37s-1.03 1.01-1.03 2.46 1.06 2.86 1.2 3.06c.15.2 2.09 3.19 5.07 4.47.71.31 1.26.49 1.69.62.71.23 1.35.2 1.86.12.57-.08 1.71-.7 1.95-1.37.24-.68.24-1.26.17-1.37-.07-.12-.27-.2-.56-.35z" />
      <path d="M12.02 2C6.5 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.08-1.33A9.96 9.96 0 0 0 12.02 22C17.53 22 22 17.52 22 12S17.53 2 12.02 2zm0 18.2c-1.66 0-3.2-.46-4.52-1.26l-.32-.19-3.02.79.81-2.94-.21-.31A8.18 8.18 0 0 1 3.8 12c0-4.53 3.7-8.2 8.22-8.2 4.53 0 8.2 3.67 8.2 8.2 0 4.53-3.67 8.2-8.2 8.2z" />
    </svg>
  );
}

/**
 * `wa.me` link — same URL shape every commercial-pages template already
 * used (`https://wa.me/{{REP_WHATSAPP}}?text=...`,
 * `templates/commercial-pages/ConexaoGreen/index.html`), built from
 * `representative.phone` instead of a template placeholder. `wa.me` expects
 * digits only, with country code, no `+`/spaces/punctuation — `phone` isn't
 * constrained to any particular shape at the schema level
 * (`representatives.phone text`, `20260731000000_create_representative_domain.sql`),
 * so this normalizes whatever was stored, assuming Brazil (+55) — same
 * assumption `formatPhoneToE164` in the leads module makes.
 */
function toWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

/**
 * AN5 (docs/QR_ANALYTICS_PLAN.md §3.3/§4) — best-effort click tracking. No
 * `preventDefault`: the browser's own navigation to `wa.me` proceeds exactly
 * as before, regardless of whether this fetch ever completes. `keepalive`
 * lets the request survive the page unloading right after the click, which
 * is the whole point of an outbound link; if the tab closes before the
 * request lands, the click simply isn't counted — the same imprecision every
 * outbound-click tracker on the web accepts, not a bug to fix here.
 */
function trackWhatsappClick(productSlug: string) {
  fetch('/api/track-click', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productSlug, referrer: document.referrer || null }),
  }).catch(() => {
    // Best-effort — a failed beacon must never surface to the visitor.
  });
}

export function WhatsappCta({
  representative,
  product,
  fullWidth = true,
  tone = 'green',
}: {
  representative: Representative;
  product: RepresentativeProduct;
  fullWidth?: boolean;
  tone?: 'green' | 'yellow';
}) {
  if (!representative.phone) return null;

  const message = `Olá! Quero saber mais sobre ${product.name}.`;
  const href = `https://wa.me/${toWhatsAppDigits(representative.phone)}?text=${encodeURIComponent(message)}`;

  return (
    <Button
      asChild
      size="lg"
      fullWidth={fullWidth}
      className={tone === 'yellow'
        ? 'commercial-heading-font rounded-full bg-[rgb(var(--commercial-sun))] font-bold text-[rgb(var(--palette-900))] shadow-[0_8px_24px_rgba(20,67,43,0.16)] hover:-translate-y-0.5 hover:bg-[rgb(var(--commercial-sun-hover))]'
        : 'commercial-heading-font rounded-full font-bold shadow-[0_8px_24px_rgba(20,67,43,0.14)] hover:-translate-y-0.5'}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsappClick(product.slug)}
      >
        <WhatsAppIcon />
        Falar no WhatsApp
      </a>
    </Button>
  );
}
