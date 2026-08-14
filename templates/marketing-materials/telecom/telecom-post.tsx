import type { MarketingMaterialProps } from '../shared/types';
import './fonts';
import styles from './telecom-post.module.css';

const BENEFITS = ['Portabilidade grátis', 'Bônus de gigas todo mês', 'Clube de benefícios incluso'];

/**
 * Post — 1080×1080.
 *
 * Composição "barras de sinal": ícone de sinal cheio como elemento gráfico
 * dominante no canto, fundo violeta/índigo vibrante — identidade jovem/tech,
 * bem distinta das demais (nenhuma outra peça usa essa paleta). Sem preço
 * na arte, conforme decisão do PO.
 */
export function TelecomPost({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.post}>
      <div className={styles.signalBars} aria-hidden="true">
        <span className={styles.bar} style={{ height: '18px' }} />
        <span className={styles.bar} style={{ height: '30px' }} />
        <span className={styles.bar} style={{ height: '44px' }} />
        <span className={styles.bar} style={{ height: '58px' }} />
        <span className={styles.bar} style={{ height: '74px' }} />
      </div>

      <span className={styles.eyebrow}>Portabilidade + internet que acumula</span>
      <h1 className={styles.headline}>
        Seu chip fica <span className={styles.highlight}>sem internet</span> antes do fim do mês?
      </h1>
      <p className={styles.subcopy}>
        Gigas que não usou não somem — acumulam pro mês seguinte. E a portabilidade do seu número é
        grátis.
      </p>

      <div className={styles.benefits}>
        {BENEFITS.map((b) => (
          <div className={styles.benefitItem} key={b}>
            <span className={styles.benefitDot} />
            <span>{b}</span>
          </div>
        ))}
      </div>

      <div className={styles.qrZone}>
        <div className={styles.qrBox}>
          <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
        </div>
        <div className={styles.qrCopy}>
          <div className={styles.qrCta}>Aponte a câmera e porta seu número</div>
          <div className={styles.qrSub}>Sem trocar de número, sem burocracia</div>
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
