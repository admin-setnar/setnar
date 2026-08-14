import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import './fonts';
import styles from './green-seguros-post.module.css';

const CHECKLIST = ['Sem anuidade', 'Sem fidelidade', 'Cancela quando quiser', 'Assistência 24h'];

/**
 * Post — 1080×1080.
 *
 * Composição "selo de proteção": escudo geométrico como elemento gráfico
 * central, fundo claro (única peça da biblioteca com fundo branco — reforça
 * o tom institucional/regulado, em contraste com as identidades escuras dos
 * produtos de energia). Checklist de benefícios reais da fonte, sem citar o
 * nome do produto/seguradora.
 */
export function GreenSegurosPost({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.post}>
      <div className={styles.shieldWrap} aria-hidden="true">
        <div className={styles.shieldOuter}>
          <div className={styles.shieldInner}>
            <span className={styles.checkMark}>✓</span>
          </div>
        </div>
      </div>

      <span className={styles.eyebrow}>Seguro de carro por assinatura</span>
      <h1 className={styles.headline}>
        Seu carro roda sem seguro, ou pagando caro de anuidade?
      </h1>
      <p className={styles.subcopy}>
        Contrate mês a mês, <span className={styles.highlight}>sem anuidade</span> e sem carência
        de fidelidade.
      </p>

      <div className={styles.checklist}>
        {CHECKLIST.map((item) => (
          <div className={styles.checkItem} key={item}>
            <span className={styles.checkIcon}>✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className={styles.qrZone}>
        <div className={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset. */}
          <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
        </div>
        <div className={styles.qrCopy}>
          <div className={styles.qrCta}>Aponte a câmera e simule</div>
          <div className={styles.qrSub}>Produto regulamentado, sujeito a análise</div>
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
