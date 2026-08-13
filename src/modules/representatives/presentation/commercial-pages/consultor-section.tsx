'use client';

import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { buildWhatsappHref, trackWhatsappClick } from '@/modules/representatives/presentation/commercial-pages/whatsapp';

/**
 * "Quem vai te atender" — ported from `#consultor` in every template
 * (byte-identical structure, `templates/commercial-pages/ConexaoClub/index.html:135-149`,
 * verified against Telecom too). Real `id="consultor"` kept literal for
 * fidelity even though styling now comes from `.consultorSection` — see
 * `commercial-page-base.module.css`'s header comment for why.
 */
export function ConsultorSection({
  representative,
  product,
}: {
  representative: Representative;
  product: RepresentativeProduct;
}) {
  const firstName = representative.name.split(' ')[0];
  const message = `Olá, ${firstName}! Quero saber mais sobre ${product.name}.`;

  return (
    <section id="consultor" className={styles.consultorSection}>
      <div className={styles.container}>
        <div className={styles.consultorCard}>
          <div className={styles.consultorInfo}>
            <span className={styles.consultorEyebrow}>Quem vai te atender</span>
            <h2>{representative.name}</h2>
            <p className={styles.consultorCargo}>Licenciado Autorizado iGreen Energy · ID {representative.authorizationId}</p>
            {representative.city ? <p className={styles.consultorLocal}>{representative.city}</p> : null}
          </div>
          {representative.phone ? (
            <a
              className={styles.btnWhats}
              id="cta-consultor"
              href={buildWhatsappHref(representative.phone, message)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsappClick(product.slug)}
            >
              Falar com {firstName}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
