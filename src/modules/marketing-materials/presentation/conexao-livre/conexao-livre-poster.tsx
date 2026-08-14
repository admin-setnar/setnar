import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import { WhatsAppGlyph } from '@/modules/marketing-materials/presentation/whatsapp-glyph';
import './fonts';
import styles from './conexao-livre-poster.module.css';

const CHECK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#3D8BFF" strokeWidth="2.4">
    <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Poster com QR Code — A4 (794×1123).
 *
 * Composição "selo de elegibilidade": um selo hexagonal com o critério de
 * qualificação (Grupo A — classificação de mercado, não é o nome do
 * produto) como elemento gráfico dominante. Diferente do checklist em chips
 * do post e da ficha técnica numerada do story.
 */
export function ConexaoLivrePoster({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.poster}>
      <div className={styles.grid} />

      <div className={styles.badgeOuter}>
        <div className={styles.badgeInner}>
          <span className={styles.badgeLabel}>Grupo A</span>
          <span className={styles.badgeSub}>média / alta tensão</span>
        </div>
      </div>

      <span className={styles.eyebrow}>Para empresas de energia em alta tensão</span>
      <h1 className={styles.headline}>
        Sua empresa paga caro de energia <span className={styles.highlight}>mesmo com estrutura própria?</span>
      </h1>

      <div className={styles.checklist}>
        <span className={styles.checkItem}>{CHECK_ICON} Transformador próprio</span>
        <span className={styles.checkItem}>{CHECK_ICON} Demanda contratada</span>
      </div>

      <div className={styles.qrZone}>
        <div className={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset. */}
          <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
        </div>
        <div className={styles.qrCopy}>
          <div className={styles.qrCta}>Aponte a câmera e simule</div>
          <div className={styles.qrSub}>Análise técnica, sem compromisso</div>
        </div>
      </div>

      {representativePhone ? (
        <div className={styles.whatsappLine}>
          <WhatsAppGlyph className={styles.whatsappIcon} />
          Fale com o especialista no WhatsApp <strong>{representativePhone}</strong>
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
