import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import { WhatsAppGlyph } from '@/modules/marketing-materials/presentation/whatsapp-glyph';
import './fonts';
import styles from './conexao-club-poster.module.css';

/**
 * Poster com QR Code — A4 (794×1123).
 *
 * Composição "billboard numérico": o dado real (+600 mil produtos e
 * serviços, presente na landing page) vira o elemento gráfico dominante,
 * diferente do post (headline dominante) e do story (ticket). Ainda assim
 * sem citar o nome do produto.
 */
export function ConexaoClubPoster({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.poster}>
      <span className={styles.eyebrow}>Desconto no dia a dia</span>
      <div className={styles.statNumber}>+600 MIL</div>
      <div className={styles.statCaption}>produtos e serviços com desconto</div>

      <h1 className={styles.headline}>
        Cansado de pagar tudo no <span className={styles.highlight}>preço cheio?</span>
      </h1>

      <div className={styles.iconRow} aria-hidden="true">
        <span className={styles.iconChip}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#FFC531" strokeWidth="1.8">
            <circle cx="9" cy="20" r="1.4" fill="#FFC531" stroke="none" />
            <circle cx="18" cy="20" r="1.4" fill="#FFC531" stroke="none" />
            <path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 7H6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className={styles.iconChip}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#FFC531" strokeWidth="1.8">
            <rect x="4" y="4" width="16" height="16" rx="5" />
            <path d="M12 8v8M8 12h8" strokeLinecap="round" />
          </svg>
        </span>
        <span className={styles.iconChip}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#FFC531" strokeWidth="1.8">
            <path d="M6 21V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 10h2a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 3 0V9l-2.5-3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 21h12" strokeLinecap="round" />
          </svg>
        </span>
        <span className={styles.iconChip}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#FFC531" strokeWidth="1.8">
            <rect x="3" y="8" width="18" height="12" rx="2" />
            <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <div className={styles.qrTag}>
        <div className={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset. */}
          <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
        </div>
        <div className={styles.qrCopy}>
          <div className={styles.qrCta}>APONTE A CÂMERA E CONFIRA</div>
          <div className={styles.qrSub}>Ativação simples, sem enrolação</div>
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
