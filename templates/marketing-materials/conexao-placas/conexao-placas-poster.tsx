import type { MarketingMaterialProps } from '../shared/types';
import { WhatsAppGlyph } from '../shared/WhatsAppGlyph';
import './fonts';
import styles from './conexao-placas-poster.module.css';

/**
 * Poster com QR Code — A4 (794×1123).
 *
 * Composição "painel em destaque": a grade de células solares vira o
 * elemento gráfico hero no topo, diferente do ícone pequeno do post e do
 * comparativo antes/depois do story.
 */
export function ConexaoPlacasPoster({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.poster}>
      <div className={styles.panelHero} aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <div className={styles.panelCell} key={i} />
        ))}
      </div>

      <span className={styles.eyebrow}>Sistema solar próprio</span>
      <h1 className={styles.headline}>
        Cansado de pagar <span className={styles.highlight}>aluguel</span> da conta de luz a vida toda?
      </h1>

      <div className={styles.paymentRow}>
        <span className={styles.paymentPill}>À vista</span>
        <span className={styles.paymentPill}>Financiado</span>
        <span className={styles.paymentPill}>No cartão</span>
      </div>

      <div className={styles.qrZone}>
        <div className={styles.qrBox}>
          <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
        </div>
        <div className={styles.qrCopy}>
          <div className={styles.qrCta}>Aponte a câmera e gere sua proposta</div>
          <div className={styles.qrSub}>Projeto personalizado, sem compromisso</div>
        </div>
      </div>

      {representativePhone ? (
        <div className={styles.whatsappLine}>
          <WhatsAppGlyph className={styles.whatsappIcon} />
          Tire dúvidas no WhatsApp <strong>{representativePhone}</strong>
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
