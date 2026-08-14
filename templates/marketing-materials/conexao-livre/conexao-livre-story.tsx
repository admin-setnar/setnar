import type { MarketingMaterialProps } from '../shared/types';
import './fonts';
import styles from './conexao-livre-story.module.css';

const SPECS = [
  { num: '01', title: 'Transformador próprio', desc: 'sua unidade já tem estrutura de média/alta tensão' },
  { num: '02', title: 'Demanda contratada', desc: 'junto à distribuidora, sem depender de assinatura' },
  { num: '03', title: 'Consumo em alta tensão', desc: 'elegível pra comprar energia direto no mercado' },
];

/**
 * Story / Status — 1080×1920.
 *
 * Composição própria: "ficha técnica" com linhas numeradas, tom de dossiê
 * B2B — bem diferente do checklist em chips do post e dos motivos usados nos
 * outros produtos.
 */
export function ConexaoLivreStory({
  representativeName,
  representativeId,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.story}>
      <div className={styles.grid} />
      <div className={styles.topSafe} />

      <div className={styles.head}>
        <span className={styles.eyebrow}>Para empresas de energia em alta tensão</span>
        <h1 className={styles.headline}>
          Sua empresa paga caro de energia <span className={styles.highlight}>mesmo com estrutura própria?</span>
        </h1>
        <p className={styles.subcopy}>Confere se sua unidade se qualifica:</p>
      </div>

      <div className={styles.specSheet}>
        {SPECS.map((spec) => (
          <div className={styles.specRow} key={spec.num}>
            <span className={styles.specNum}>{spec.num}</span>
            <div>
              <div className={styles.specTitle}>{spec.title}</div>
              <div className={styles.specDesc}>{spec.desc}</div>
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
            <div className={styles.qrCta}>Arrasta pra cima e simula</div>
            <div className={styles.qrSub}>Análise técnica, sem compromisso</div>
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
