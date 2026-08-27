'use client';

import type { ReactNode } from 'react';

import type { OriginId } from '@/modules/analytics/domain/origin';
import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { buildWhatsappHref, trackWhatsappClick } from '@/modules/representatives/presentation/commercial-pages/whatsapp';

/**
 * Ported from `.hero#topo > .container.hero-grid` — identical shell across
 * all 7 templates (verified against ConexaoLivre too); only the eyebrow,
 * headline, subhead, CTA message/label and the right-column widget differ.
 */
export function HeroSection({
  representative,
  product,
  eyebrow,
  headline,
  subhead,
  ctaMessage,
  ctaLabel,
  heroNote,
  widget,
  origin,
}: {
  representative: Representative;
  product: RepresentativeProduct;
  eyebrow: string;
  headline: string;
  subhead: string;
  ctaMessage: string;
  ctaLabel: string;
  heroNote: string;
  widget: ReactNode;
  origin: OriginId | null;
}) {
  return (
    <section className={styles.hero} id="topo">
      <div className={`${styles.container} ${styles.heroGrid}`}>
        <div>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{headline}</h1>
          <p className={styles.subhead}>{subhead}</p>
          <div className={styles.heroCtas}>
            {representative.phone ? (
              <a
                className={styles.btnWhats}
                id="cta-hero"
                href={buildWhatsappHref(representative.phone, ctaMessage)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsappClick(product.slug, origin)}
              >
                {ctaLabel}
              </a>
            ) : null}
          </div>
          <p className={styles.heroNote}>{heroNote}</p>
        </div>
        <div>{widget}</div>
      </div>
    </section>
  );
}
