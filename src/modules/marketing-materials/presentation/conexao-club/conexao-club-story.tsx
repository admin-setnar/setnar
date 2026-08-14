import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import './fonts';
import styles from './conexao-club-story.module.css';

const CATEGORIES = [
  {
    label: 'Mercado',
    caption: 'supermercado, açougue, padaria',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#FFC531" strokeWidth="1.8">
        <circle cx="9" cy="20" r="1.4" fill="#FFC531" stroke="none" />
        <circle cx="18" cy="20" r="1.4" fill="#FFC531" stroke="none" />
        <path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 7H6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Farmácia',
    caption: 'remédios e produtos de saúde',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#FFC531" strokeWidth="1.8">
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Posto',
    caption: 'combustível com desconto',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#FFC531" strokeWidth="1.8">
        <path d="M6 21V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v15" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 10h2a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 3 0V9l-2.5-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 21h12" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Viagem',
    caption: 'hospedagem e passagens',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#FFC531" strokeWidth="1.8">
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" strokeLinecap="round" />
      </svg>
    ),
  },
];

/**
 * Story / Status — 1080×1920.
 *
 * Composição própria (não é o Post esticado): um "passe de descontos" em
 * formato de ticket, com corte de perfuração, listando categorias em vez do
 * bloco único do post. Reforça a dor sem citar o nome do produto.
 */
export function ConexaoClubStory({
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
        <span className={styles.eyebrow}>Desconto no dia a dia</span>
        <h1 className={styles.headline}>
          CANSADO DE PAGAR TUDO NO <span className={styles.highlight}>PREÇO CHEIO?</span>
        </h1>
        <p className={styles.subcopy}>Seu passe de desconto pra mais de 600 mil lugares no Brasil inteiro.</p>
      </div>

      <div className={styles.ticketWrap}>
        <div className={styles.ticket}>
          <div className={styles.rows}>
            {CATEGORIES.map((cat) => (
              <div className={styles.row} key={cat.label}>
                <span className={styles.rowIcon}>{cat.icon}</span>
                <span>
                  <div className={styles.rowLabel}>{cat.label}</div>
                  <div className={styles.rowCaption}>{cat.caption}</div>
                </span>
              </div>
            ))}
          </div>

          <div className={styles.perforation}>
            <span className={styles.notch} />
            <span className={styles.dashedLine} />
            <span className={styles.notch} />
          </div>

          <div className={styles.qrBlock}>
            <div className={styles.qrBox}>
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset. */}
              <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
            </div>
            <div>
              <div className={styles.qrCta}>ARRASTA PRA CIMA E CONFIRA</div>
              <div className={styles.qrSub}>Ativação simples, sem enrolação</div>
            </div>
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
