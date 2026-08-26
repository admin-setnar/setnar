'use client';

import type { OriginId } from '@/modules/analytics/domain/origin';
import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { buildWhatsappHref, trackWhatsappClick } from '@/modules/representatives/presentation/commercial-pages/whatsapp';
import { WhatsAppIcon } from '@/modules/representatives/presentation/commercial-pages/whatsapp-icon';

/** Ported from the bare `<section><div class="cta-final">...` at the end of every template. */
export function CtaFinalSection({
  representative,
  product,
  title,
  description,
  message,
  buttonLabel = 'Falar no WhatsApp agora',
  origin,
}: {
  representative: Representative;
  product: RepresentativeProduct;
  title: string;
  description: string;
  message: string;
  buttonLabel?: string;
  origin: OriginId | null;
}) {
  return (
    <section>
      <div className={styles.container}>
        <div className={styles.ctaFinal}>
          <h2>{title}</h2>
          <p>{description}</p>
          {representative.phone ? (
            <a
              className={styles.btnWhats}
              id="cta-final"
              href={buildWhatsappHref(representative.phone, message)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsappClick(product.slug, origin)}
            >
              <WhatsAppIcon />
              {buttonLabel}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
