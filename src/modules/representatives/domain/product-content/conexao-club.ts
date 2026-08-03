/**
 * Conteúdo das abas de categoria do Conexão Club — cópia extraída de
 * `templates/commercial-pages/ConexaoClub/index.html`'s `CATEGORIAS` (linha
 * 305-311), a mesma fonte já aprovada por compliance que o template estático
 * usa. Mesmo padrão de `product-compliance-notice.ts` (ADR-055): conteúdo
 * variável por produto vive em código, versionado por diff/PR, não em coluna
 * `jsonb` em `products` — zero migration (ADR-056).
 *
 * Sem `mensagemWhatsapp` por aba: confirmado no `<script>` do template que o
 * CTA (`id="cat-cta"`) usa sempre o mesmo texto fixo ao trocar de categoria —
 * ConexaoClub, ao contrário de ConexaoPlacas/GreenSeguros, não varia o CTA
 * por conteúdo.
 */

export type ProductContentTab = {
  chave: string;
  rotulo: string;
  descricao: string;
};

export const CONEXAO_CLUB_TABS: ProductContentTab[] = [
  {
    chave: 'mercado',
    rotulo: 'Mercado',
    descricao: 'Descontos em redes de supermercado parceiras, para o seu dia a dia render mais.',
  },
  {
    chave: 'farmacia',
    rotulo: 'Farmácia',
    descricao: 'Economia em farmácias parceiras na compra de medicamentos e produtos de higiene.',
  },
  {
    chave: 'viagem',
    rotulo: 'Viagem',
    descricao: 'Condições especiais em passagens, hospedagem e pacotes de viagem.',
  },
  {
    chave: 'lazer',
    rotulo: 'Lazer',
    descricao: 'Descontos em cinema, parques e opções de entretenimento perto de você.',
  },
  {
    chave: 'combustivel',
    rotulo: 'Combustível',
    descricao: 'Economia no abastecimento em postos parceiros da rede.',
  },
];

/**
 * Resolve qual aba está ativa dado um array de abas e a chave selecionada —
 * função pura, sem estado React, para o mesmo motivo que `getProductComplianceNotice`
 * é testada isoladamente: o risco real (a descrição errada aparecendo para a
 * categoria errada) mora neste lookup, não no JSX que o consome.
 * `null` para uma chave fora do array, nunca a primeira aba como fallback
 * silencioso — mesmo princípio de `getProductComplianceNotice`.
 */
export function getActiveTab(
  tabs: ProductContentTab[],
  chave: string,
): ProductContentTab | null {
  return tabs.find((tab) => tab.chave === chave) ?? null;
}
