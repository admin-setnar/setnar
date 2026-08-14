import type { MarketingMaterialProps } from '../shared/types';
import './fonts';
import styles from './conexao-placas-post.module.css';

/**
 * Post para redes sociais — 1080×1080.
 *
 * Dor: pagar aluguel da conta de luz a vida toda em vez de ter sistema
 * próprio. Ângulo de propriedade (compra/financiamento), diferente do
 * ângulo de assinatura da Solar. Identidade própria (azul-marinho quente +
 * terracota, motivo de placa solar), sem citar o nome do produto.
 */
export function ConexaoPlacasPost({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.post}>
      <div className={styles.glow} />
      <div className={styles.panelIcon} aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <div className={styles.panelCell} key={i} />
        ))}
      </div>

      <div className={styles.content}>
        <span className={styles.eyebrow}>Sistema solar próprio</span>
        <h1 className={styles.headline}>
          CANSADO DE PAGAR
          <br />
          <span className={styles.highlight}>ALUGUEL DA CONTA</span>
          <br />
          DE LUZ A VIDA TODA?
        </h1>
        <p className={styles.subcopy}>
          Tenha suas próprias placas solares. Projeto personalizado, fornecedores homologados — você escolhe como
          pagar.
        </p>
        <div className={styles.paymentRow}>
          <span className={styles.paymentPill}>À vista</span>
          <span className={styles.paymentPill}>Financiado</span>
          <span className={styles.paymentPill}>No cartão</span>
        </div>
      </div>

      <div className={styles.qrSection}>
        <div className={styles.divider} />
        <div className={styles.qrZone}>
          <div className={styles.qrBox}>
            <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
          </div>
          <div className={styles.qrCopy}>
            <div className={styles.qrCta}>Aponte a câmera e gere sua proposta</div>
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
