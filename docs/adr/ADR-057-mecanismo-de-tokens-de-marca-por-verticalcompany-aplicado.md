### ADR-057 — Mecanismo de tokens de marca por vertical/Company, aplicado à Commercial Page da iGreen (CP9)

> **STATUS ATUAL — APROVADO PARA AS COMMERCIAL PAGES CONTROLADAS (13/08/2026).**
> O Product Owner confirmou a validação da autorização de marca e dos claims
> comerciais para os sete templates portados pela SET-78. A autorização não
> transforma a SETNAR em canal oficial, não libera edição de identidade ou copy
> pelo representante e não se estende a outros materiais. O texto histórico
> abaixo registra por que o mecanismo nasceu como protótipo.

**Nota (04/08/2026).** Pedro decidiu prosseguir com CP9 sem aguardar
confirmação formal de CP1 — decisão de negócio, aceitando o risco descrito
acima. O mecanismo técnico e as ressalvas de contraste/`--palette-700`
continuam válidas como estão; só a precondição de aprovação deixou de
bloquear o merge.

**Contexto.** `docs/COMMERCIAL_PAGE_CONTENT_PLAN.md` §3.3 separou "conteúdo
mais rico" (ADR-056/CP3) de "visual on-brand com a iGreen" de propósito, e
registrou a segunda como a decisão mais sensível do documento — depende de
confirmação da Política de Uso da Marca (CP1), ainda pendente. Pedro decidiu
implementar mesmo assim, como protótipo interno para apresentar à iGreen e
pedir essa aprovação, não como algo a publicar. Uma investigação prévia
(Fases 1 e 2, aprovadas por Pedro e por esta revisão antes deste passo)
confirmou os fatos abaixo antes de qualquer código:

- `BrandTokensStyle` (`src/modules/tenancy/presentation/brand-tokens.tsx`)
  só emitia `:root{...}` — nenhum conceito de tema por vertical existia.
- `RepresentativeProduct` não carregava a Company do Product, embora o
  schema já tivesse `products.company_id → companies.slug` (seed confirma
  `igreen`) — dado presente, só não exposto no tipo de domínio nem na query.
- As 3 cores de marca (`--verde-profundo` #07311D, `--verde-vivo-escuro`
  #00893F, `--verde-vivo` #00B359) são idênticas, byte-a-byte, nos 7
  `templates/commercial-pages/*/style.css`.
- Cálculo real de contraste WCAG (fórmula de luminância relativa, não
  estimativa) mostrou que branco sobre `--verde-vivo` mede 2.77:1 —
  **falha AA (4.5:1 para texto normal)**. Isso já é um defeito no próprio
  `.btn-whats` dos 7 templates originais da iGreen (texto 16px/700, abaixo
  do limiar de "texto grande"), não uma regressão introduzida aqui.

**Mecanismo — escopo por atributo, não por `:root`.** `BrandTokensStyle`
ganhou um parâmetro `scope?: string`; quando presente, emite
`[data-vertical="${scope}"]{...}` em vez de `:root{...}`. Um elemento fora
dessa subárvore (o resto do app, `<html className="scroll-smooth">`, `.dark`)
continua vendo o `:root` do SETNAR normalmente — nenhum dos dois depende de
token algum. Dentro da subárvore, qualquer token que a regra escopada não
redeclare (`--palette-700`, e por extensão `--ring`, que deriva dele) segue
herdando do `:root` por cascata normal de custom property — decisão
deliberada, não uma omissão: os 3 tons da iGreen não produzem um 4º valor
intermediário, e inventar um sem aprovação seria fechar sozinho exatamente o
tipo de decisão de marca que este protótipo existe para não fechar.

**Mapeamento de cores.**
`src/modules/representatives/domain/company-brand/igreen.ts` exporta
`IGREEN_TOKENS` (RGB, mesmo formato de `setnarTenant.brand.tokens`):
`--palette-900` `7 49 29` (verde-profundo), `--palette-800` `0 137 63`
(verde-vivo-escuro), `--palette-500` `0 179 89` (verde-vivo — só acento,
nunca fundo com texto em cima), `--palette-200` `207 238 218` (borda),
`--palette-50` `245 250 246` (fundo). `--brand`/`--content` continuam
derivando de `--palette-900` (14.32:1 e 14.97:1 contra fundo/branco — folga
grande); `--brand-hover` deriva de `--palette-800`, branco em cima mede
**4.52:1 — passa AA raspando, margem de 0.02**, o mesmo tipo de margem
apertada que o comentário de `--content-subtle` em `globals.css` já
sinalizava como perigosa. Confirmado presente de verdade no protótipo: o
botão do `WhatsappCta`/`LeadForm` (`Button` variant `primary`, default) usa
`bg-brand hover:bg-brand-hover text-brand-contrast` — o estado de hover é
exatamente esse par de 4.52:1.

**Detecção da Company — slug real, não `if (true)`.** O select de
`SupabaseRepresentativeRepository.findPublishedActivation` passou a incluir
`company:companies!inner ( slug )` dentro do embed de `product` — join
aditivo, mesmo padrão já usado para `representative`/`product`, RLS de
`companies_select_public` já `using (true)`. `RepresentativeProduct` ganhou
`companySlug: string`; `SupabaseRepresentativeCatalogRepository` (a leitura
do hub D5.1) recebeu o mesmo join, trocando o cast cego anterior por um
mapeamento explícito, já que o tipo agora exige o campo de verdade.
`src/modules/representatives/domain/company-brand/resolve-company-vertical.ts`
expõe `resolveCompanyVertical(companySlug)`, que devolve `{ vertical,
tokens }` só para slugs presentes em `COMPANY_BRAND_TOKENS` (hoje só
`igreen`) — `undefined` para qualquer outra Company, o que
`[productSlug]/page.tsx` trata como "renderizar o tema genérico do SETNAR".
Crescer para uma segunda Company é adicionar uma entrada ao mapa, não mudar
a função. `page.tsx` renderiza `<main data-vertical={companyVertical?.vertical}>`
e, só quando resolvido, `<BrandTokensStyle tokens={...} scope={...} />` como
primeiro filho de `<main>` — não em `layout.tsx`, que continua intocado.

**Teste.** `tests/resolve-company-vertical.test.ts` cobre
`resolveCompanyVertical` (resolve `igreen` com os tokens certos; `undefined`
para qualquer slug fora do mapa, inclusive string vazia — o risco real, uma
Company não-iGreen herdando a paleta por engano) no mesmo nível de
`product-compliance-notice.test.ts`, sem infraestrutura de render React.

**Verificação.** `npm run typecheck`/`lint`/`test`/`test:integration`/`build`
passam limpos (256/256 testes). Verificação manual via
`curl -H "Host: teste-novo-a.setnar.com" localhost:3001/conexao-green`:

- HTML servido contém `<main id="conteudo" data-vertical="igreen">` seguido,
  como primeiro filho, de
  `<style>[data-vertical="igreen"]{--palette-900:7 49 29;--palette-800:0 137 63;--palette-500:0 179 89;--palette-200:207 238 218;--palette-50:245 250 246;}</style>`
  — valores RGB conferem byte-a-byte com os deste ADR.
- `curl` na home (`/`) e em `/entrar`, mesmo Host: nenhum `data-vertical` no
  HTML, `:root{--palette-900:20 33 61;...}` do SETNAR intacto — o azul-marinho
  original, não tocado.
- `/conexao-club` retornou **HTTP 404**: nenhum representante de teste no
  banco atual tem essa Product Activation publicada — mesma limitação já
  registrada em ADR-056, ainda não resolvida. O mecanismo de CP9 em si (join,
  `data-vertical`, `BrandTokensStyle` escopado) é idêntico para os 7
  produtos; a verificação ponta a ponta específica de `/conexao-club` fica
  como próximo passo, exatamente como ADR-056 já previa.
- FOUC: o `<style>` escopado chega dentro do HTML da própria resposta SSR
  (não injetado por script depois do mount), posicionado antes de qualquer
  conteúdo de `<main>` que leia esses tokens — estruturalmente não há uma
  janela de "flash azul depois verde". Não foi possível gravar o paint num
  navegador real: a resolução de Representative depende do header `Host` de
  um subdomínio (`teste-novo-a.setnar.com`), que a instância de browser deste
  ambiente não consegue enviar sem alterar o `hosts` do sistema — mesma
  restrição prática que já levou ADR-056 a verificar só por `curl`.
- Contraste branco-sobre-`--palette-800` (4.52:1): confirmado pela mesma
  fórmula WCAG usada na Fase 2 (luminância relativa), não por uma ferramenta
  de scan automatizado — nenhum Lighthouse CLI/axe CLI está disponível neste
  ambiente para uma segunda verificação independente desse número.

**Limitação registrada, não resolvida neste passo.** `/conexao-club`
continua sem Product Activation publicada em nenhum representante de teste
(mesma lacuna de ADR-056); a margem de 4.52:1 no hover do CTA primário
passa AA mas por pouco, e fica registrada aqui para revisão futura, não
corrigida silenciosamente trocando a cor sem aprovação da iGreen.

**Custo de reversão.** Baixo — um parâmetro opcional em `BrandTokensStyle`
(sem uso, vira no-op), um arquivo de tokens novo, um join aditivo (reversível
removendo a cláusula), um campo a mais em `RepresentativeProduct`, e uma
condicional em `page.tsx`. Nenhuma migration nova.

**Não coberto por este passo, de propósito.** As outras 6 páginas iGreen
(ConexaoSolar, ConexaoLivre, ConexaoPlacas, GreenSeguros, Telecom, e o
próprio Conexão Club quando publicado) não tiveram template/design tocado —
herdam o mesmo mecanismo automaticamente assim que tiverem uma Product
Activation publicada, sem código extra. Publicação pública deste protótipo
fora do representante de teste já usado em CP3, e resolução do valor de
`--palette-700`, continuam fora do escopo até CP1 responder e a iGreen
revisar o mapeamento de cores deste ADR.

---
