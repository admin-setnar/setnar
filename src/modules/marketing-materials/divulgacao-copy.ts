import type { OriginId } from '@/modules/analytics/domain/origin';

/**
 * SET-84 D2 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md §2) — catálogo de
 * copy/CTA para o fluxo de Divulgação. **4 templates, um por canal, não 28**
 * (7 produtos × 4 canais) — a rodada valida se material+texto+CTA+link
 * prontos aumentam a execução de divulgação, não otimiza copy por produto.
 * `qrcode`/`direct` não têm entrada: esses dois canais entregam só link/QR,
 * sem copy social (o representante já sabe o que fazer com um link).
 */
export interface DivulgacaoCopyParams {
  readonly productName: string;
  readonly link: string;
}

export interface DivulgacaoCopy {
  readonly text: string;
  readonly cta: string;
}

type DivulgacaoCopyTemplate = (params: DivulgacaoCopyParams) => DivulgacaoCopy;

const TEMPLATES: Partial<Record<OriginId, DivulgacaoCopyTemplate>> = {
  instagram_post: ({ productName, link }) => ({
    text: `Quer saber mais sobre ${productName}? Chama no link da bio ou clica aqui: ${link}`,
    cta: 'Ver detalhes',
  }),
  instagram_story: ({ productName, link }) => ({
    text: `Novidade: ${productName} 👀 Toca aqui e fala comigo: ${link}`,
    cta: 'Saiba mais',
  }),
  whatsapp: ({ productName, link }) => ({
    text: `Oi! Passando pra te contar sobre ${productName}. Dá uma olhada aqui: ${link}`,
    cta: 'Falar comigo',
  }),
};

/**
 * Resolve o texto/CTA prontos para o canal escolhido no fluxo de Divulgação.
 * Retorna `null` para `qrcode`/`direct` — esses dois canais não têm copy
 * social (D2), a UI oferece só `Copiar link`/QR.
 *
 * `productSlug` é aceito e ignorado nesta rodada (D2, "sobrescrita futura"):
 * o parâmetro já existe na assinatura para que um mapa de overrides por
 * produto × canal (`Record<productSlug, Partial<Record<OriginId, ...>>>`),
 * se algum dia for necessário, plugue aqui sem exigir que quem chama esta
 * função mude. Nenhum mapa desses existe hoje — não criar um sem um caso de
 * uso real (critério de não-overengineering do plano).
 */
export function resolveDivulgacaoCopy(
  origin: OriginId,
  _productSlug: string,
  params: DivulgacaoCopyParams,
): DivulgacaoCopy | null {
  const template = TEMPLATES[origin];
  return template ? template(params) : null;
}
