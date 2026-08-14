import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import { WhatsAppGlyph } from '@/modules/marketing-materials/presentation/whatsapp-glyph';
import './fonts';
import styles from './conexao-solar-poster.module.css';

const STEPS = ['Simulação', 'Documentos', 'Vistoria', 'Instalação'];

/**
 * Poster com QR Code — A4 (794×1123).
 *
 * Composição "nascer do sol": arcos concêntricos como elemento gráfico
 * dominante no topo, diferente do chip de etapas do post e da linha do
 * tempo vertical do story.
 */
export function ConexaoSolarPoster({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.poster}>
      <div className={styles.sunburstWrap} aria-hidden="true">
        <div className={styles.ring1} />
        <div className={styles.ring2} />
        <div className={styles.ring3} />
        <div className={styles.core} />
      </div>

      <span className={styles.eyebrow}>Energia solar sem entrada</span>
      <h1 className={styles.headline}>
        Quer energia solar <span className={styles.highlight}>sem gastar nada de entrada?</span>
      </h1>
      <div className={styles.statChip}>
        <span className={styles.statNumber}>50%</span>
        <span className={styles.statLabel}>de bônus na primeira fatura</span>
      </div>

      <div className={styles.stepRow} aria-hidden="true">
        {STEPS.map((label, i) => (
          <div className={styles.step} key={label}>
            <span className={styles.stepDot}>{i + 1}</span>
            <span className={styles.stepLabel}>{label}</span>
          </div>
        ))}
      </div>

      <div className={styles.qrZone}>
        <div className={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset. */}
          <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
        </div>
        <div className={styles.qrCopy}>
          <div className={styles.qrCta}>Aponte a câmera e comece</div>
          <div className={styles.qrSub}>Central dedicada em cada etapa</div>
        </div>
      </div>

      {representativePhone ? (
        <div className={styles.whatsappLine}>
          <WhatsAppGlyph className={styles.whatsappIcon} />
          Prefere combinar por WhatsApp? <strong>{representativePhone}</strong>
        </div>
      ) : null}

      <div className={styles.spacer} />

      <div className={styles.footer}>
        <div className={styles.footerId}>
          <strong>{representativeName}</strong> — Licenciado Autorizado iGreen Energy (ID: {representativeId})
        </div>
      </div>
    </div>
  );
}
