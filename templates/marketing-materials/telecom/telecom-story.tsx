import type { MarketingMaterialProps } from '../shared/types';
import './fonts';
import styles from './telecom-story.module.css';

const PAIN_CARDS = [
  { icon: '✕', title: 'Sem internet', desc: 'faltam dias pra renovar e os dados já acabaram' },
  { icon: '✕', title: 'Portar o número', desc: 'parece complicado, então você nunca troca' },
];
const GAIN_CARDS = [
  { icon: '✓', title: 'Internet que acumula', desc: 'o que sobrar este mês fica pro próximo' },
  { icon: '✓', title: 'Portabilidade grátis', desc: 'mesmo número, chip novo, sem burocracia' },
];

/**
 * Story / Status — 1080×1920.
 *
 * Composição "pilha de notificações": cartões no estilo notificação de
 * celular, dor em cima (cinza/vermelho) virando ganho embaixo (neon) —
 * explora o formato vertical com uma metáfora nativa do público jovem/
 * digital, sem repetir nenhum arquétipo já usado nos outros produtos.
 */
export function TelecomStory({
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
        <span className={styles.eyebrow}>Portabilidade + internet que acumula</span>
        <h1 className={styles.headline}>
          Seu chip fica <span className={styles.highlight}>sem internet</span> antes do fim do mês?
        </h1>
      </div>

      <div className={styles.stack}>
        {PAIN_CARDS.map((c) => (
          <div className={`${styles.card} ${styles.cardPain}`} key={c.title}>
            <span className={`${styles.cardIcon} ${styles.iconPain}`}>{c.icon}</span>
            <div>
              <div className={styles.cardTitle}>{c.title}</div>
              <div className={styles.cardDesc}>{c.desc}</div>
            </div>
          </div>
        ))}

        <div className={styles.switchLabel}>muda pra:</div>

        {GAIN_CARDS.map((c) => (
          <div className={`${styles.card} ${styles.cardGain}`} key={c.title}>
            <span className={`${styles.cardIcon} ${styles.iconGain}`}>{c.icon}</span>
            <div>
              <div className={styles.cardTitle}>{c.title}</div>
              <div className={styles.cardDesc}>{c.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.ctaZone}>
        <div className={styles.qrZone}>
          <div className={styles.qrBox}>
            <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
          </div>
          <div className={styles.qrCopy}>
            <div className={styles.qrCta}>Arrasta pra cima e porta seu número</div>
            <div className={styles.qrSub}>Sem trocar de número, sem burocracia</div>
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
