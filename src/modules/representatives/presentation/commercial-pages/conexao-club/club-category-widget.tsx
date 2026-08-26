'use client';

import { useState } from 'react';

import type { OriginId } from '@/modules/analytics/domain/origin';
import clubStyles from '@/modules/representatives/presentation/commercial-pages/conexao-club/conexao-club.module.css';
import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { buildWhatsappHref, trackWhatsappClick } from '@/modules/representatives/presentation/commercial-pages/whatsapp';

/** Ported from `.cat-tabs`/`#cat-desc`/`#cat-cta` and their inline `<script>` in ConexaoClub/index.html. */
const CATEGORIES = [
  { key: 'mercado', label: 'Mercado', description: 'Descontos em redes de supermercado parceiras, para o seu dia a dia render mais.' },
  { key: 'farmacia', label: 'Farmácia', description: 'Economia em farmácias parceiras na compra de medicamentos e produtos de higiene.' },
  { key: 'viagem', label: 'Viagem', description: 'Condições especiais em passagens, hospedagem e pacotes de viagem.' },
  { key: 'lazer', label: 'Lazer', description: 'Descontos em cinema, parques e opções de entretenimento perto de você.' },
  { key: 'combustivel', label: 'Combustível', description: 'Economia no abastecimento em postos parceiros da rede.' },
] as const;

export function ClubCategoryWidget({
  representative,
  product,
  origin,
}: {
  representative: Representative;
  product: RepresentativeProduct;
  origin: OriginId | null;
}) {
  const [active, setActive] = useState<(typeof CATEGORIES)[number]['key']>('mercado');
  const activeCategory = CATEGORIES.find((category) => category.key === active) ?? CATEGORIES[0];

  return (
    <div className={styles.billCard}>
      <div className={styles.billHeader}>
        <span>Veja o que dá pra economizar</span>
        <span className={styles.badgeDesconto}>+600 mil produtos e serviços</span>
      </div>
      <div className={clubStyles.catTabs} role="tablist" aria-label="Categorias de benefício">
        {CATEGORIES.map((category) => (
          <button
            key={category.key}
            type="button"
            role="tab"
            aria-selected={active === category.key}
            className={active === category.key ? clubStyles.active : undefined}
            onClick={() => setActive(category.key)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <p className={clubStyles.catDesc} aria-live="polite">
        {activeCategory.description}
      </p>
      {representative.phone ? (
        <a
          className={`${styles.btnWhats} ${styles.billCta}`}
          href={buildWhatsappHref(representative.phone, 'Olá! Quero ativar meu Conexão Club.')}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsappClick(product.slug, origin)}
        >
          Quero economizar assim
        </a>
      ) : null}
    </div>
  );
}
