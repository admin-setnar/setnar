import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import './fonts';
import styles from './conexao-green-story.module.css';

/**
 * Story / Status — 1080×1920. Portada verbatim de
 * `templates/marketing-materials/conexao-green/`.
 *
 * Composição própria para o formato vertical (não é o Post esticado):
 * layout centralizado, zonas seguras de topo/rodapé para a UI do
 * Instagram/WhatsApp, e um selo circular decorativo no miolo que ocupa o
 * espaço vertical extra em vez de simplesmente repetir o bloco do post.
 * Mesma identidade Green (navy/amarelo/menta), mesmo gancho de dor, sem citar
 * o nome do produto.
 */
export function ConexaoGreenStory({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.story}>
      <div className={styles.topSafe} />

      <div className={styles.head}>
        <span className={styles.eyebrow}>Energia mais barata</span>
        <h1 className={styles.headline}>
          Sua conta de luz tá <span className={styles.highlight}>pesada?</span>
        </h1>
        <p className={styles.subcopy}>Dá pra pagar menos todo mês, sem obra e sem trocar de distribuidora.</p>
      </div>

      <div className={styles.badgeZone}>
        <div className={styles.badgeRing}>
          <svg className={styles.badgeBolt} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M13 2L4 14H11L10 22L20 9H13L13 2Z" fill="#FFD400" />
          </svg>
          <span className={styles.badgeWord}>menos peso na conta</span>
        </div>
      </div>

      <div className={styles.ctaZone}>
        <div className={styles.qrZone}>
          <div className={styles.qrBox}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset. */}
            <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
          </div>
          <div>
            <div className={styles.qrCta}>Arrasta pra cima e simula</div>
            <div className={styles.qrSub}>Grátis, em 2 minutos</div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerId}>
          <strong>{representativeName}</strong> — Licenciado Autorizado iGreen Energy (ID: {representativeId})
        </div>
        {representativePhone ? (
          <div className={styles.footerPhone}>
            WhatsApp <strong>{representativePhone}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}
