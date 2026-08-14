import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import { WhatsAppGlyph } from '@/modules/marketing-materials/presentation/whatsapp-glyph';
import './fonts';
import styles from './conexao-green-poster.module.css';

/**
 * Poster com QR Code — A4 (794×1123). Portada verbatim de
 * `templates/marketing-materials/conexao-green/`, calibrada para o tamanho
 * real de impressão.
 */
export function ConexaoGreenPoster({
  representativeName,
  representativeId,
  representativePhone,
  publicUrl,
  qrCodeDataUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.poster}>
      <svg className={styles.boltMark} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 2L4 14H11L10 22L20 9H13L13 2Z" fill="#FFD400" />
      </svg>

      <div className={styles.content}>
        <span className={styles.eyebrow}>Energia mais barata</span>
        <h1 className={styles.headline}>
          SUA CONTA
          <br />
          DE LUZ TÁ
          <br />
          <span className={styles.highlight}>PESADA?</span>
        </h1>
        <p className={styles.subcopy}>
          Isso aqui resolve. Escaneie o QR code e veja em 2 minutos quanto você pode economizar todo mês.
        </p>
      </div>

      <div className={styles.divider} />

      <div className={styles.qrZone}>
        <div className={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset. */}
          <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
        </div>
        <div className={styles.qrCopy}>
          <div className={styles.qrCta}>
            Aponte a câmera
            <br />e economize
          </div>
          <div className={styles.qrSub}>Simulação gratuita e sem compromisso</div>
        </div>
      </div>

      {representativePhone ? (
        <div className={styles.whatsappLine}>
          <WhatsAppGlyph className={styles.whatsappIcon} />
          Prefere falar direto? WhatsApp <strong>{representativePhone}</strong>
        </div>
      ) : null}

      <div className={styles.footer}>
        <div className={styles.footerId}>
          <strong>{representativeName}</strong> — Licenciado Autorizado iGreen Energy (ID: {representativeId})
        </div>
      </div>
    </div>
  );
}
