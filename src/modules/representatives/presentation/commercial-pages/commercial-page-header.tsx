'use client';

import type { OriginId } from '@/modules/analytics/domain/origin';
import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { buildWhatsappHref, trackWhatsappClick } from '@/modules/representatives/presentation/commercial-pages/whatsapp';
import { WhatsAppIcon } from '@/modules/representatives/presentation/commercial-pages/whatsapp-icon';

/**
 * Ported from every template's `<header>` (byte-identical structure —
 * `templates/commercial-pages/ConexaoClub/index.html:62-80`, verified
 * against Telecom and GreenSeguros too — only the product name and the
 * WhatsApp message text vary).
 */
export function CommercialPageHeader({
  representative,
  product,
  productName,
  headerMessage,
  origin,
}: {
  representative: Representative;
  product: RepresentativeProduct;
  productName: string;
  headerMessage: string;
  origin: OriginId | null;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a href="#topo" className={styles.logo}>
          <span className={styles.logoDot} aria-hidden="true" />
          <span className={styles.logoText}>
            {productName}
            <small className={styles.logoSub}>
              <span className={styles.full}>
                {representative.name} · Licenciado Autorizado iGreen Energy · ID {representative.authorizationId}
              </span>
              <span className={styles.short}>
                {representative.name} · Licenciado iGreen · ID {representative.authorizationId}
              </span>
            </small>
          </span>
        </a>
        {representative.phone ? (
          <a
            className={styles.btnWhats}
            id="cta-header"
            href={buildWhatsappHref(representative.phone, headerMessage)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar agora no WhatsApp"
            onClick={() => trackWhatsappClick(product.slug, origin)}
          >
            <WhatsAppIcon />
            <span className={styles.full}>Falar no WhatsApp</span>
          </a>
        ) : null}
      </div>
    </header>
  );
}
