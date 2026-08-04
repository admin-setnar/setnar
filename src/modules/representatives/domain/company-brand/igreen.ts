import type { BrandTokens } from '@/modules/tenancy/domain/tenant';

/**
 * PROTÓTIPO NÃO APROVADO — a Política de Uso da Marca da iGreen ainda não
 * confirmou que replicar sua paleta/identidade visual por software é
 * permitido (README ADR-057; ver docs/COMMERCIAL_PAGE_CONTENT_PLAN.md
 * §3.3/CP1). Nada que consome isto deve ser tratado como decisão de marca
 * fechada — só um exemplo interno para pedir aprovação à iGreen.
 *
 * Valores das 3 cores de marca dos 7 templates originais
 * (`templates/commercial-pages/*\/style.css`, idênticos byte-a-byte nos 7),
 * convertidos de hex para os canais RGB que `BrandTokensStyle` espera:
 * `--verde-profundo` #07311D, `--verde-vivo-escuro` #00893F,
 * `--verde-vivo` #00B359, `--borda` #CFEEDA, `--fundo` #F5FAF6.
 *
 * `--palette-500` (verde-vivo) é só acento — nunca fundo de texto. Branco
 * sobre `--verde-vivo` mede 2.77:1 (falha WCAG AA, que exige 4.5:1 para
 * texto normal); é assim nos próprios templates da iGreen, não uma
 * regressão introduzida aqui. `--palette-900` é o valor usado onde
 * `globals.css` deriva `--brand`/`--content`, por ter folga de contraste
 * confortável (14.32:1 e 14.97:1 respectivamente).
 *
 * `--palette-700` fica deliberadamente de fora: os 3 tons da iGreen não
 * produzem um 4º valor intermediário, e inventar um sem aprovação seria
 * exatamente o tipo de decisão de marca este protótipo não pode fechar
 * sozinho. `--ring` (que deriva de `--palette-700` em `globals.css`)
 * continua herdando o valor do SETNAR por cascata normal de custom
 * property dentro de `[data-vertical="igreen"]`.
 */
export const IGREEN_TOKENS: BrandTokens = {
  '--palette-900': '7 49 29',
  '--palette-800': '0 137 63',
  '--palette-500': '0 179 89',
  '--palette-200': '207 238 218',
  '--palette-50': '245 250 246',
};
