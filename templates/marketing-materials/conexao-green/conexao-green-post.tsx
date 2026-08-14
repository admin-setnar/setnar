import type { MarketingMaterialProps } from '../shared/types';
import './fonts';
import styles from './conexao-green-post.module.css';

/**
 * Post para redes sociais — 1080×1080.
 *
 * Peça publicitária autônoma sobre o problema da conta de luz cara, pensada
 * para Instagram Feed / Facebook / WhatsApp. NÃO cita o nome do produto — o
 * gancho é a dor (conta de luz pesada), o CTA leva ao QR/link do licenciado.
 * A landing page (destino do QR) é quem explica o produto em detalhe.
 *
 * Identidade calibrada pela referência aprovada
 * (ConexaoGreen/marketing/poster-qrcode-conexaogreen.html): fundo navy,
 * amarelo de destaque, verde-menta de apoio, Archivo Black para headline.
 * Composição própria para o formato quadrado — não é um redimensionamento
 * do poster.
 *
 * Sem lógica de negócio: recebe os dados do licenciado via props e apenas
 * apresenta.
 */
export function ConexaoGreenPost({
  representativeName,
  representativeId,
  representativeCity,
  representativePhone,
  publicUrl,
  qrCodeDataUrl,
}: MarketingMaterialProps) {
  return (
    <div className={styles.post}>
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
          Aponte a câmera e veja em 2 minutos quanto dá pra economizar todo mês.
        </p>
      </div>

      <div className={styles.qrSection}>
        <div className={styles.divider} />
        <div className={styles.qrZone}>
          <div className={styles.qrBox}>
            <img src={qrCodeDataUrl} alt={`QR Code para ${publicUrl}`} />
          </div>
          <div className={styles.qrCopy}>
            <div className={styles.qrCta}>Aponte a câmera
              <br />e economize</div>
            <div className={styles.qrSub}>Simulação gratuita e sem compromisso</div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerId}>
          <strong>{representativeName}</strong> — Licenciado Autorizado iGreen Energy
          {' '}(ID: {representativeId})
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
