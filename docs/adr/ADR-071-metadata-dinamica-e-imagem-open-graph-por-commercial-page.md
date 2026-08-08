### ADR-071 — Metadata dinâmica e imagem Open Graph por Commercial Page, com fallback anti-enumeração (SET-11)

**Status:** Accepted
**Date:** 2026-08-07
**Related:** Aplica o princípio anti-enumeração do ADR-030 ao `<head>` e à
imagem social, não só ao corpo da página; reutiliza a forma da URL pública
que o D5.3 do ADR-046 já fixou (`SITE_URL` + slug, não o `Host` da
request); respeita a separação de portas do ADR-031 (`RepresentativeRepository`
distinto de `TenantRepository`) e a regra de dependência unidirecional que a
própria `resolve-representative.ts` já documentava.

#### Contexto e problema

`src/app/[productSlug]/page.tsx` nunca exportou `generateMetadata`. Toda
Commercial Page publicada — de qualquer Representative, qualquer Product —
herdava sem diferenciação o metadata genérico de `app/layout.tsx`:
`alternates.canonical` resolvia sempre para `/` (via `metadataBase =
SITE_URL`, ou seja, sempre `https://setnar.com/`), `openGraph.url` era o
`SITE_URL` fixo, e título/descrição vinham do tenant SETNAR, nunca do
Representative/Product resolvido. Uma página válida, um host inválido e o
`not-found.tsx` eram, em metadata, indistinguíveis de qualquer outra página
genérica do site — correto para o caso inválido (é exatamente o que ADR-030
já decidiu para o corpo), mas errado para o caso válido, que é o que SET-11
pede para corrigir.

Não havia nenhum teste de SEO/metadata no repositório — nem para
`buildTenantMetadata` (`config/seo.ts`), nem para este caso.

#### Alternativas consideradas

1. **Construir o metadata do Representative/Product diretamente dentro de
   `generateMetadata`, repetindo a composição `getRepresentativeRepository()`
   + `resolveRepresentativeActivation()` que o corpo da página já fazia.**
   Rejeitada: sem memoização, isso paga a consulta ao Supabase duas vezes
   por request (uma em `generateMetadata`, outra no corpo) — mesmo problema
   que `getCurrentUser` (`auth-gateway-factory.ts`) já resolveu para
   `getUser()`/`profiles`, com `cache()` do React. Adotado o mesmo padrão:
   novo `resolveCommercialPageActivation` em
   `modules/representatives/presentation/resolve-commercial-page-activation.ts`,
   memoizado por request, chamado pelos dois lugares.
2. **Colocar o builder de metadata do Representative/Product em
   `config/seo.ts`, ao lado de `buildTenantMetadata`.** Rejeitada:
   `config/seo.ts` é genérico — `config/site.ts` (de quem `seo.ts` depende)
   hoje só é importado de `application/`/`presentation/` de módulos, nunca
   o inverso, e `ARCHITECTURE.md` atribui "Commercial Page presentation"
   explicitamente ao módulo `representatives`. Importar `RepresentativeActivation`
   dentro de `config/` inverteria essa fronteira. Escolhido: o builder
   (`resolveCommercialPageMetadata`) vive em
   `modules/representatives/presentation/commercial-page-metadata.ts`.
3. **No caso `activation === null`, recalcular manualmente um metadata
   "genérico" (`buildTenantMetadata(await resolveTenant(host))`) para
   devolver de `generateMetadata`.** Rejeitada após ler
   `node_modules/next/dist/lib/metadata/resolve-metadata.js`
   (`mergeMetadata`): o resultado de `generateMetadata` de uma página é
   mesclado no metadata já resolvido do(s) layout(s) pai **campo a campo,
   só para as chaves que o objeto retornado realmente possui**
   (`for (const key_ in source)`). Retornar `{}` deixa o metadata do
   `app/layout.tsx` inalterado — o mesmo resultado de uma recomputação
   manual, sem uma segunda implementação que poderia divergir da primeira
   com o tempo. `resolveCommercialPageMetadata(null)` retorna `{}`.
4. **Usar o `Host` bruto da request (`headers().get('host')`) para compor a
   URL canônica/Open Graph, já que é o mesmo dado que
   `resolveRepresentativeActivation` usa para resolver a página.**
   Rejeitada: o D5.3 do ADR-046 já preferiu compor a partir de `SITE_URL` +
   slug em vez do `Host` da request para o link público/QR code do hub —
   mesmo motivo se aplica aqui, e evita reabrir casos de borda de
   normalização (maiúsculas, porta, espaço) que `extractRepresentativeSlug`
   já trata só para decidir o slug, não para reemitir a URL. Escolhido:
   `buildCommercialPageUrl(representative, product)`, nova função em
   `modules/representatives/presentation/commercial-page-url.ts`, única
   fonte da string `https://<slug>.<rootHost>/<productSlug>` — usada tanto
   pelo metadata quanto por `representative-hub.tsx`, que antes a
   duplicava inline duas vezes (link de texto + QR code).
5. **Colocar o wrapper `cache()` (item 1) dentro de
   `representative-repository-factory.ts` (infraestrutura), já que é ele
   quem constrói o repositório.** Rejeitada: exigiria que a infraestrutura
   importasse `resolveRepresentativeActivation` de `application/`,
   invertendo a Dependency Rule (`UI/Application → Domain → Infrastructure`)
   e o motivo pelo qual aquela função recebe o repositório como parâmetro
   explícito — documentado no próprio arquivo, para permanecer testável
   fora de qualquer contexto de request. Escolhido: o wrapper vive em
   `presentation/`, camada onde essa composição já acontecia inline (dentro
   do Server Component).
6. **Sem imagem Open Graph própria por página, por falta de qualquer asset
   no repositório.** Premissa inicial, baseada em uma busca incompleta (por
   conteúdo de arquivo, não pela convenção de nome `opengraph-image`) —
   corrigida ao rodar `npm run build` e ver a rota `/opengraph-image` já
   existir. `app/opengraph-image.tsx` já gera, por request, um card social
   típográfico a partir do tenant resolvido (`next/og`'s `ImageResponse`),
   herdado hoje por toda página, inclusive `[productSlug]`. Definir um
   `openGraph` completo na página (necessário para título/URL/descrição
   corretos) teria **removido** essa imagem herdada sem substituto: o merge
   do Next substitui `openGraph` inteiro por segmento que o define, não
   campo a campo (mesma leitura de `mergeMetadata` do item 3) — descoberta
   a tempo de corrigir antes de landar, não depois. Rejeitada a alternativa
   de aceitar a regressão ("sem imagem por enquanto"); escolhida a correção
   completa: item 7.
7. **Gerar uma imagem Open Graph própria por (Representative, Product),
   reaproveitando a convenção de arquivo do Next.** Escolhida. Extraído
   `config/opengraph-card.tsx` (`OpenGraphCardFrame` + `TenantOpenGraphCard`)
   do que antes era só JSX inline em `app/opengraph-image.tsx` — mesmo
   layout, `brandName` como parâmetro em vez de lido de `Tenant` dentro do
   frame, para que `[productSlug]/opengraph-image.tsx` (que não importa
   `tenancy`, mesmo motivo do item 2) possa reusá-lo passando o literal
   `'Setnar'`. Novo arquivo colocado exatamente em `[productSlug]/`, não
   fora dele: confirmado contra `mergeStaticMetadata` (mesmo arquivo do
   item 3) que um `opengraph-image` colocado no segmento da rota é
   injetado automaticamente em `openGraph.images` sempre que o metadata
   daquele segmento não define `images` por conta própria — que é
   exatamente o caso, já que `resolveCommercialPageMetadata` nunca define
   `images`. Nenhuma URL de imagem foi montada à mão.

#### Decisão

Três arquivos novos em `modules/representatives/presentation/`:
- `commercial-page-url.ts` — `buildCommercialPageUrl(representative, product)`,
  única fonte de `https://<slug>.<rootHost>/<productSlug>` (ADR-026).
- `commercial-page-metadata.ts` — `resolveCommercialPageMetadata(activation)`:
  `null` → `{}`; ativação válida → `alternates.canonical`, `openGraph`
  completo (`type`, `locale` fixo `pt_BR`, `url`, `siteName: 'Setnar'`,
  `title`, `description`) e `twitter` completo (`summary_large_image`),
  título `"<Product> — <Representative>"`, descrição `"Fale com
  <Representative>, representante autorizado, sobre <Product>."`. Nunca
  define `images` — a imagem vem do item 7.
- `resolve-commercial-page-activation.ts` — `resolveCommercialPageActivation`,
  `cache()`-wrapped, compõe `getRepresentativeRepository()` +
  `resolveRepresentativeActivation()` uma vez por request.

Um arquivo novo em `config/`:
- `opengraph-card.tsx` — `OpenGraphCardFrame` (layout puro, `brandName` por
  parâmetro) e `TenantOpenGraphCard` (aplica o frame ao `Tenant` resolvido).

Um arquivo novo em `app/`:
- `[productSlug]/opengraph-image.tsx` — card com `product.name` +
  `representative.name`; `activation === null` renderiza
  `TenantOpenGraphCard` (idêntico ao que qualquer outra página genérica já
  mostra), nunca um card "não encontrado" diferenciado.

Editados: `[productSlug]/page.tsx` (exporta `generateMetadata`, corpo
passa a chamar `resolveCommercialPageActivation` em vez de compor o
repositório inline), `representative-hub.tsx` (usa
`buildCommercialPageUrl` no lugar dos dois templates inline), e
`app/opengraph-image.tsx` (refatorado para `TenantOpenGraphCard`, sem
mudança de comportamento).

`tests/commercial-page-url.test.ts` e `tests/commercial-page-metadata.test.ts`
cobrem a lógica pura — ativação válida e as quatro variações de `null`
(host de Company tenant, representative inexistente, activation em draft,
representative suspenso) —, seguindo o mesmo padrão de
`resolve-representative.test.ts` (`node:test` +
`InMemoryRepresentativeRepository`). A geração de imagem e o merge de
metadata do próprio Next não são cobertos por teste automatizado — ver
*Consequências*.

#### Consequências

- Toda Commercial Page publicada emite canonical, Open Graph e Twitter
  Card corretos — critério de aceite do SET-11 — e ganha uma imagem social
  própria (produto + representante), onde antes herdava sempre o card
  genérico do tenant.
- O princípio anti-enumeração do ADR-030 agora vale também para `<head>` e
  para a imagem, por dois mecanismos independentes e redundantes: (1)
  `resolveCommercialPageMetadata`/`[productSlug]/opengraph-image.tsx`
  retornam/renderizam o genérico explicitamente para `null`; (2) descoberto
  ao verificar manualmente — quando `notFound()` dispara no corpo da
  página, o próprio Next troca a árvore de resolução de metadata para a do
  `not-found.tsx` da raiz, e nem chega a invocar o `generateMetadata`/
  `opengraph-image` da página de produto nesse caminho. O primeiro
  mecanismo não é redundante à toa: é o único que roda quando alguém
  acessa `/[productSlug]/opengraph-image` diretamente, sem passar pelo
  corpo da página (confirmado manualmente, ver abaixo).
- `buildCommercialPageUrl` remove uma duplicação que já existia duas vezes
  em `representative-hub.tsx` antes de virar três com este ADR.
- `config/opengraph-card.tsx` é uma nova superfície compartilhada fora de
  qualquer módulo, mesmo papel que `config/seo.ts` já tem — reusada pelo
  card genérico (tenant) e pelo card do Commercial Page (representatives),
  sem que nenhum dos dois importe o outro.
- Custo aceito: `[productSlug]/opengraph-image.tsx` roda como uma request
  HTTP separada de `[productSlug]/page.tsx` (um crawler social busca as
  duas URLs de forma independente) — o `cache()` de
  `resolveCommercialPageActivation` deduplica dentro de uma única árvore de
  render, não entre requests distintas, então a imagem sempre paga sua
  própria consulta ao Supabase. Mesmo custo que a imagem genérica da raiz
  já tinha antes deste ADR, não uma regressão nova.
- Risco aceito, registrado por não ter automação própria: o merge de
  metadata e a injeção de imagem por convenção de arquivo são mecânica
  interna do Next, não coberta por `tests/*.test.ts` (que testam só a
  lógica pura, `node:test` sem servidor). Verificado manualmente em vez
  disso — `npm run build` (rota `/[productSlug]/opengraph-image` aparece
  na listagem) e, ao vivo, via `curl` contra o dev server: (a) baseline da
  raiz inalterada; (b) host de representative inválido
  (`nao-existe.setnar.com/conexao-green`) com `<head>` idêntico ao
  genérico e imagem 200/PNG 1200×630 (fallback); (c) página real já
  publicada no projeto Supabase conectado
  (`teste-novo-a.setnar.com/conexao-green`, dado pré-existente, nenhuma
  escrita feita) com canonical/`og:url`
  `https://teste-novo-a.setnar.com/conexao-green`, título `"Conexão Green
  — Teste Novo A"`, `og:image`/`twitter:image` apontando para
  `/conexao-green/opengraph-image`, e o PNG renderizado com o conteúdo
  correto.

#### Rollback conceitual

Nenhuma migration, nenhum dado de negócio. Reversão é puramente de
aplicação: remover `generateMetadata` de `[productSlug]/page.tsx`, os três
arquivos novos em `representatives/presentation/`,
`[productSlug]/opengraph-image.tsx` e `config/opengraph-card.tsx` (revertendo
`app/opengraph-image.tsx` e `representative-hub.tsx` às suas versões
anteriores) restaura exatamente o comportamento pré-SET-11 — metadata
genérico herdado em toda Commercial Page, sem diferenciação por
Representative/Product.
