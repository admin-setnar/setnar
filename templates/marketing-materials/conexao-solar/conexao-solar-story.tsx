import type { MarketingMaterialProps } from '../shared/types';
import './fonts';
import styles from './conexao-solar-story.module.css';

const STOPS = [
  { title: 'Simulação', desc: 'você manda os dados, sem compromisso' },
  { title: 'Documentos', desc: 'checklist simples, a central te orienta' },
  { title: 'Vistoria', desc: 'técnico avalia seu telhado e sua instalação' },
  { title: 'Instalação', desc: 'sistema no ar, com bônus na primeira fatura' },
];

/**
 * Story / Status — 1080×1920.
 *
 * Composição própria: linha do tempo vertical das 4 etapas do processo,
 * explorando a verticalidade em vez de repetir o post (que usa a mesma
 * jornada em formato horizontal). Reforça o diferencial de acompanhamento
 * guiado sem citar o nome do produto.
 */
export function ConexaoSolarStory({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.story}>
      <div className={styles.sunGlow} />
      <div className={styles.topSafe} />

      <div className={styles.head}>
        <span className={styles.eyebrow}>Energia solar sem entrada</span>
        <h1 className={styles.headline}>
          Quer energia solar <span className={styles.highlight}>sem gastar nada de entrada?</span>
        </h1>
        <div className={styles.statChip}>
          <span className={styles.statNumber}>50%</span>
          <span className={styles.statLabel}>de bônus na primeira fatura</span>
        </div>
      </div>

      <div className={styles.timeline}>
        <div className={styles.timelineLine} />
        {STOPS.map((stop, i) => (
          <div className={styles.stop} key={stop.title}>
            <span className={styles.stopDot}>{i + 1}</span>
            <div>
              <div className={styles.stopTitle}>{stop.title}</div>
              <div className={styles.stopDesc}>{stop.desc}</div>
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
            <div className={styles.qrCta}>Arrasta pra cima e comece</div>
            <div className={styles.qrSub}>Central dedicada em cada etapa</div>
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
