import type { MarketingMaterialProps } from '../shared/types';
import './fonts';
import styles from './conexao-livre-post.module.css';

const CHECK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#3D8BFF" strokeWidth="2.4">
    <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Post para redes sociais — 1080×1080.
 *
 * Dor: empresas com estrutura própria (transformador, demanda contratada)
 * pagando caro de energia sem saber que podem comprar direto. Público B2B —
 * identidade deliberadamente mais sóbria/técnica que os produtos residenciais
 * (grafite + azul elétrico, malha técnica de fundo). Sem citar o nome do
 * produto nem o termo "mercado livre" como marca.
 */
export function ConexaoLivrePost({
  representativeName,
  representativeId,
  representativeCity,
  representativePhone,
  qrCodeDataUrl,
  publicUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.post}>
      <div className={styles.grid} />
      <div className={styles.glow} />

      <div className={styles.content}>
        <span className={styles.eyebrow}>Para empresas de energia em alta tensão</span>
        <h1 className={styles.headline}>
          Sua empresa paga caro de energia <span className={styles.highlight}>mesmo com estrutura própria?</span>
        </h1>
        <p className={styles.subcopy}>
          Se sua unidade tem transformador próprio e demanda contratada, dá pra comprar energia direto — pagando
          menos do que hoje.
        </p>

        <div className={styles.checklist}>
          <span className={styles.checkItem}>
            {CHECK_ICON} Transformador próprio
          </span>
          <span className={styles.checkItem}>
            {CHECK_ICON} Demanda contratada
          </span>
        </div>
      </div>

      <div className={styles.qrSection}>
        <div className={styles.divider} />
        <div className={styles.qrZone}>
          <div className={styles.qrBox}>
            <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
          </div>
          <div className={styles.qrCopy}>
            <div className={styles.qrCta}>Aponte a câmera e simule</div>
            <div className={styles.qrSub}>Análise técnica, sem compromisso</div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerId}>
          <strong>{representativeName}</strong> — Licenciado Autorizado iGreen Energy (ID: {representativeId})
          {representativeCity ? ` · ${representativeCity}` : ''}
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
