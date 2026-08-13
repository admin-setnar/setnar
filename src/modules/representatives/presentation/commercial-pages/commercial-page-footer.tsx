import Link from 'next/link';

import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import { NOT_OFFICIAL_CHANNEL_NOTICE } from '@/modules/representatives/domain/product-compliance-notice';
import type { Representative } from '@/modules/representatives/domain/representative';

/**
 * Ported from every template's `<footer>` (byte-identical 3-paragraph shape
 * — `templates/commercial-pages/ConexaoClub/index.html:288-294`, verified
 * against Telecom and GreenSeguros too; only the disclaimer sentence and the
 * LGPD field list vary per product). `disclaimer` and `dataCollectedNote`
 * are supplied per product page, adapted from the template's own wording —
 * `dataCollectedNote` specifically, since every product's page now collects
 * the same 4 fields (nome/telefone/cidade/email) rather than whatever
 * product-specific field that product's own template listed there (see the
 * 2026-08-13 decision to keep one shared lead-form field set).
 *
 * A única adição aos três parágrafos originais é o aviso comum de que a
 * SETNAR é uma plataforma independente das empresas representadas.
 */
export function CommercialPageFooter({
  representative,
  disclaimer,
  dataCollectedNote,
}: {
  representative: Representative;
  /** Mantido no contrato para as sete chamadas continuarem explícitas por produto. */
  productSlug: string;
  disclaimer: string;
  dataCollectedNote: string;
}) {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p>{disclaimer}</p>
        <p>
          Site produzido por <strong>{representative.name}</strong> — Licenciado Autorizado iGreen Energy (ID:{' '}
          <strong>{representative.authorizationId}</strong>). Este não é um site oficial da iGreen Energy.
        </p>
        <p className={styles.footerPrivacy}>
          {dataCollectedNote} <Link href="/privacidade">Política de Privacidade</Link>
        </p>
        <p className={styles.footerPrivacy}>{NOT_OFFICIAL_CHANNEL_NOTICE}</p>
      </div>
    </footer>
  );
}
