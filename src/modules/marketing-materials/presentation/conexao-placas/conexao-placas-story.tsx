import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import './fonts';
import styles from './conexao-placas-story.module.css';

/**
 * Story / Status — 1080×1920.
 *
 * Composição própria: comparação visual abstrata "antes/depois" (sem
 * sistema × com sistema próprio), explorando a verticalidade em vez de
 * repetir o post. Reforça a dor sem citar o nome do produto.
 */
export function ConexaoPlacasStory({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.story}>
      <div className={styles.glow} />
      <div className={styles.topSafe} />

      <div className={styles.head}>
        <span className={styles.eyebrow}>Sistema solar próprio</span>
        <h1 className={styles.headline}>
          Cansado de pagar <span className={styles.highlight}>aluguel</span> da conta de luz a vida toda?
        </h1>
        <p className={styles.subcopy}>Projeto personalizado, fornecedores homologados, você escolhe como pagar.</p>
      </div>

      <div className={styles.compare}>
        <div className={styles.compareRow}>
          <div className={`${styles.swatch} ${styles.swatchBefore}`} />
          <div>
            <div className={styles.compareLabel}>SEM SISTEMA PRÓPRIO</div>
            <div className={styles.compareCaption}>você paga o desconto de aluguel, sempre</div>
          </div>
        </div>

        <div className={styles.arrowDivider} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="#E2672A" strokeWidth="2.4">
            <path d="M12 4v16M6 14l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className={styles.compareRow}>
          <div className={`${styles.swatch} ${styles.swatchAfter}`}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div className={styles.cell} key={i} />
            ))}
          </div>
          <div>
            <div className={styles.compareLabel}>COM SISTEMA PRÓPRIO</div>
            <div className={styles.compareCaption}>seu, financiável, pra sempre</div>
          </div>
        </div>
      </div>

      <div className={styles.ctaZone}>
        <div className={styles.qrZone}>
          <div className={styles.qrBox}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset. */}
            <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
          </div>
          <div className={styles.qrCopy}>
            <div className={styles.qrCta}>Arrasta pra cima e gere sua proposta</div>
            <div className={styles.qrSub}>Projeto personalizado, sem compromisso</div>
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
