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

export function WhatsappCta({
  representative,
  product,
}: {
  representative: Representative;
  product: RepresentativeProduct;
}) {
  if (!representative.phone) return null;

  const message = `Olá! Quero saber mais sobre ${product.name}.`;
  const href = `https://wa.me/${toWhatsAppDigits(representative.phone)}?text=${encodeURIComponent(message)}`;

  return (
    <Button asChild size="lg" fullWidth>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden="true" className="h-5 w-5" />
        Falar no WhatsApp
      </a>
    </Button>
  );
}
