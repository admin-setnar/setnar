'use client';

import { MessageCircle } from 'lucide-react';

import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { Button } from '@/shared/ui/button';

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
}: {
  representative: Representative;
  product: RepresentativeProduct;
  fullWidth?: boolean;
}) {
  if (!representative.phone) return null;

  const message = `Olá! Quero saber mais sobre ${product.name}.`;
  const href = `https://wa.me/${toWhatsAppDigits(representative.phone)}?text=${encodeURIComponent(message)}`;

  return (
    <Button asChild size="lg" fullWidth={fullWidth}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsappClick(product.slug)}
      >
        <MessageCircle aria-hidden="true" className="h-5 w-5" />
        Falar no WhatsApp
      </a>
    </Button>
  );
}
