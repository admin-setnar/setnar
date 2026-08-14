import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import { WhatsAppGlyph } from '@/modules/marketing-materials/presentation/whatsapp-glyph';
import './fonts';
import styles from './telecom-poster.module.css';

/**
 * Poster com QR Code — A4 (794×1123).
 *
 * Composição "gráfico de sinal": linha ilustrativa comparando o sinal/dados
 * de um chip comum (caindo ao longo do mês) com um chip cuja internet
 * acumula (estável) — metáfora visual qualitativa, sem números/estatísticas
 * inventadas. Arquétipo próprio, diferente do post e do story.
 */
export function TelecomPoster({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.poster}>
      <span className={styles.eyebrow}>Portabilidade + internet que acumula</span>
      <h1 className={styles.headline}>
        Seu chip fica <span className={styles.highlight}>sem internet</span> antes do fim do mês?
      </h1>

      <div className={styles.chartCard}>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotMuted}`} /> Chip comum
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotNeon}`} /> Internet que acumula
          </span>
        </div>
        <svg viewBox="0 0 600 200" className={styles.chart} aria-hidden="true">
          <line x1="0" y1="170" x2="600" y2="170" stroke="rgba(242,238,252,0.14)" strokeWidth="1" />
          <line x1="0" y1="110" x2="600" y2="110" stroke="rgba(242,238,252,0.08)" strokeWidth="1" />
          <line x1="0" y1="50" x2="600" y2="50" stroke="rgba(242,238,252,0.08)" strokeWidth="1" />
          <polyline
            points="0,45 100,68 200,95 300,120 400,142 500,158 600,170"
            fill="none"
            stroke="#b7aed6"
            strokeWidth="4"
            strokeDasharray="10 8"
            strokeLinecap="round"
          />
          <polyline
            points="0,32 100,28 200,34 300,26 400,30 500,24 600,28"
            fill="none"
            stroke="#39ff9e"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className={styles.chartAxis}>
          <span>Início do mês</span>
          <span>Fim do mês</span>
        </div>
      </div>

      <div className={styles.qrZone}>
        <div className={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset. */}
          <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
        </div>
        <div className={styles.qrCopy}>
          <div className={styles.qrCta}>Aponte a câmera e porta seu número</div>
          <div className={styles.qrSub}>Sem trocar de número, sem burocracia</div>
        </div>
      </div>

      {representativePhone ? (
        <div className={styles.whatsappLine}>
          <WhatsAppGlyph className={styles.whatsappIcon} />
          Prefere chamar no WhatsApp? <strong>{representativePhone}</strong>
        </div>
      ) : null}

      <div className={styles.spacer} />

      <div className={styles.footer}>
        <div className={styles.footerId}>
          <strong>{representativeName}</strong> — Licenciado Autorizado iGreen Energy (ID: {representativeId})
        </div>
        <div className={styles.finePrint}>
          Sujeito à disponibilidade de rede e às regras de portabilidade da operadora.
        </div>
      </div>
    </div>
  );
}
