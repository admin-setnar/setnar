import type { MarketingMaterialProps } from '../shared/types';
import './fonts';
import styles from './conexao-solar-post.module.css';

const STEPS = ['Simulação', 'Documentos', 'Vistoria', 'Instalação'];

/**
 * Post para redes sociais — 1080×1080.
 *
 * Dor: barreira de custo inicial para ter energia solar. Diferencial: bônus
 * real na primeira fatura (dado da landing page) + acompanhamento guiado —
 * ângulo de assinatura, oposto ao de compra da Placas. Identidade própria
 * (marrom-quase-preto + âmbar), sem citar o nome do produto.
 */
export function ConexaoSolarPost({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.post}>
      <div className={styles.sunGlow} />

      <div className={styles.content}>
        <span className={styles.eyebrow}>Energia solar sem entrada</span>
        <h1 className={styles.headline}>
          Quer energia solar <span className={styles.highlight}>sem gastar nada de entrada?</span>
        </h1>
        <p className={styles.subcopy}>
          Sistema instalado no seu imóvel, com acompanhamento do início ao fim — sem custo pra começar.
        </p>
        <div className={styles.statChip}>
          <span className={styles.statNumber}>50%</span>
          <span className={styles.statLabel}>de bônus na primeira fatura</span>
        </div>
      </div>

      <div className={styles.stepRow} aria-hidden="true">
        <div className={styles.stepRowLine} />
        {STEPS.map((label, i) => (
          <div className={styles.step} key={label}>
            <span className={styles.stepDot}>{i + 1}</span>
            <span className={styles.stepLabel}>{label}</span>
          </div>
        ))}
      </div>

      <div className={styles.qrSection}>
        <div className={styles.qrZone}>
          <div className={styles.qrBox}>
            <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
          </div>
          <div className={styles.qrCopy}>
            <div className={styles.qrCta}>Aponte a câmera e comece sua análise</div>
            <div className={styles.qrSub}>Central dedicada em cada etapa</div>
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
