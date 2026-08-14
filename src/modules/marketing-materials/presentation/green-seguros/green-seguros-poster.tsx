import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import { WhatsAppGlyph } from '@/modules/marketing-materials/presentation/whatsapp-glyph';
import './fonts';
import styles from './green-seguros-poster.module.css';

const ROWS: Array<{ label: string; old: string; assinatura: string }> = [
  { label: 'Anuidade', old: 'Cobrada todo ano', assinatura: 'Não existe' },
  { label: 'Fidelidade', old: '12 meses', assinatura: 'Nenhuma' },
  { label: 'Cancelamento', old: 'Processo demorado', assinatura: 'Quando quiser' },
  { label: 'Assistência', old: 'Depende do plano', assinatura: '24 horas' },
];

/**
 * Poster com QR Code — A4 (794×1123).
 *
 * Composição "tabela comparativa": seguro tradicional vs. por assinatura,
 * lado a lado — formato editorial/institucional, diferente do escudo do
 * post e do cartão do story. Nenhum valor de indenização ou promessa de
 * "sem risco" — apenas condições comerciais citadas na fonte.
 */
export function GreenSegurosPoster({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.poster}>
      <div className={styles.shieldMark} aria-hidden="true" />
      <span className={styles.eyebrow}>Seguro de carro por assinatura</span>
      <h1 className={styles.headline}>
        Seu carro roda sem seguro, ou pagando caro de anuidade?
      </h1>
      <p className={styles.subcopy}>Compare o modelo tradicional com o seguro por assinatura:</p>

      <div className={styles.table}>
        <div className={styles.tableHead}>
          <div className={styles.colLabel} />
          <div className={styles.colOld}>Tradicional</div>
          <div className={styles.colNew}>Por assinatura</div>
        </div>
        {ROWS.map((row) => (
          <div className={styles.tableRow} key={row.label}>
            <div className={styles.colLabel}>{row.label}</div>
            <div className={styles.colOld}>{row.old}</div>
            <div className={styles.colNew}>
              <span className={styles.checkIcon}>✓</span>
              {row.assinatura}
            </div>
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

      {representativePhone ? (
        <div className={styles.whatsappLine}>
          <WhatsAppGlyph className={styles.whatsappIcon} />
          Prefere falar com um especialista? WhatsApp <strong>{representativePhone}</strong>
        </div>
      ) : null}

      <div className={styles.spacer} />

      <div className={styles.footer}>
        <div className={styles.footerId}>
          <strong>{representativeName}</strong> — Licenciado Autorizado iGreen Energy (ID: {representativeId})
        </div>
        <div className={styles.finePrint}>
          Condições comerciais sujeitas a análise e aprovação. Consulte os termos completos no ato da contratação.
        </div>
      </div>
    </div>
  );
}
