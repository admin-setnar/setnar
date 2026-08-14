import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import './fonts';
import styles from './green-seguros-story.module.css';

const FIELDS = [
  { label: 'Cobertura', value: 'Seu carro' },
  { label: 'Modalidade', value: 'Por assinatura, mês a mês' },
  { label: 'Fidelidade', value: 'Nenhuma — cancela quando quiser' },
  { label: 'Assistência', value: '24 horas por dia' },
];

/**
 * Story / Status — 1080×1920.
 *
 * Composição "cartão de apólice": em vez do escudo do post, simula um
 * cartão/documento institucional com campos preenchidos, reforçando
 * seriedade e transparência — arquétipo próprio, não usado em nenhum outro
 * produto da biblioteca.
 */
export function GreenSegurosStory({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.story}>
      <div className={styles.topSafe} />

      <div className={styles.head}>
        <span className={styles.eyebrow}>Seguro de carro por assinatura</span>
        <h1 className={styles.headline}>
          Seu carro roda sem seguro, ou pagando caro de anuidade?
        </h1>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.stamp}>
            <span>✓</span>
          </div>
          <div className={styles.cardHeaderText}>
            <div className={styles.cardTitle}>Condições resumidas</div>
            <div className={styles.cardSub}>Produto regulamentado, sujeito a análise</div>
          </div>
        </div>
        <div className={styles.rows}>
          {FIELDS.map((f) => (
            <div className={styles.row} key={f.label}>
              <span className={styles.rowLabel}>{f.label}</span>
              <span className={styles.rowValue}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.ctaZone}>
        <div className={styles.qrZone}>
          <div className={styles.qrBox}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset. */}
            <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
          </div>
          <div className={styles.qrCopy}>
            <div className={styles.qrCta}>Arrasta pra cima e simule</div>
            <div className={styles.qrSub}>Sem anuidade, sem fidelidade</div>
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
