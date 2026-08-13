'use client';

import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { buildWhatsappHref, trackWhatsappClick } from '@/modules/representatives/presentation/commercial-pages/whatsapp';
import { WhatsAppIcon } from '@/modules/representatives/presentation/commercial-pages/whatsapp-icon';

/**
 * `.float-whats` — byte-identical markup and CSS in all 7 templates
 * (`id="cta-flutuante"`, fixed bottom-right, hidden above 760px). The one
 * piece of UI genuinely shared across every product page, unlike sections
 * whose content differs per template even where the CSS class names match.
 */
export function FloatingWhatsapp({
  representative,
  product,
  message,
}: {
  representative: Representative;
  product: RepresentativeProduct;
  message: string;
}) {
  if (!representative.phone) return null;

  return (
    <a
      className={`${styles.btnWhats} ${styles.floatWhats}`}
      href={buildWhatsappHref(representative.phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      onClick={() => trackWhatsappClick(product.slug)}
    >
      <WhatsAppIcon size={24} />
    </a>
  );
}
