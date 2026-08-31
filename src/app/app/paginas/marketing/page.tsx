import { redirect } from 'next/navigation';

/**
 * Materiais foi absorvido por Divulgação (ADR-094, reverte SET-104): a tela
 * que vivia aqui mudou para `/app/divulgacao/biblioteca` sem nenhuma
 * mudança de comportamento. Esta rota permanece só como redirect — seguro
 * barato contra bookmarks/deep links antigos, já que nenhuma outra
 * referência in-app a este caminho foi encontrada.
 */
export default function MarketingRedirectPage() {
  redirect('/app/divulgacao/biblioteca');
}
