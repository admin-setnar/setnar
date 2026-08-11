### ADR-080 — Preview privado da Commercial Page: rota fora do `/app` shell, reusa RLS existente sem migration (SET-36)

**Status:** Accepted
**Date:** 2026-08-10
**Related:** Extends `RepresentativeRepository` (ADR implícito de
`resolve-representative.ts`); consome `product_activations_select_own`
já criada por ADR-063/`20260805000000_fix_rls_policy_cycle.sql`; consome
`AuthenticatedAppLayout` (`src/app/app/layout.tsx`) só como referência de
padrão de auth, não como shell.

#### Contexto e problema

SET-36 pede: configurar → visualizar → conferir → publicar, sem publicar de
verdade só para conferir. Hoje `[productSlug]/page.tsx` só resolve uma
Commercial Page pelo caminho público (`findPublishedActivation`, `status =
'published'` via RLS) — não existe nenhum caminho privado.

Três perguntas de arquitetura:

1. Onde essa RLS já existe, ou precisa de migration nova?
2. Onde a rota do preview deve morar — dentro de `/app` (shell autenticado
   com sidebar) ou fora?
3. O conteúdo renderizado precisa ser uma cópia mantida à mão, ou pode ser
   o mesmo componente que a página pública usa?

#### Alternativas consideradas

1. **Migration nova para uma policy de leitura "própria, qualquer status".**
   Rejeitada: `product_activations_select_own`
   (`20260804000000`, recriada em `20260805000000` sobre
   `is_own_representative()`) já concede exatamente isso — "o dono da linha
   enxerga as próprias ativações, inclusive `draft` e `unpublished`". Nenhuma
   migration nova foi necessária; só um método de leitura novo no repositório
   de aplicação, por cima de RLS que já existia antes deste SET.
2. **Rota do preview aninhada em `src/app/app/paginas/[productSlug]/preview/`.**
   Rejeitada: toda rota sob `src/app/app/` herda `AuthenticatedAppLayout`
   (sidebar fixa de 240px no desktop) por construção do App Router — não dá
   para "pular" um layout ancestral sem reestruturar a árvore de rotas
   existente. Herdar a sidebar quebraria diretamente o critério de aceite
   "conteúdo e responsividade correspondem à página final": a largura
   disponível no desktop seria outra, divergente da página pública real.
3. **Rota raiz nova, `src/app/pre-visualizacao/[productSlug]/`, com seu
   próprio auth check.** Escolhida. Mesmo nível de `[productSlug]/`,
   `entrar/`, `termos/` — nenhum layout ancestral além do `RootLayout` global.
   A própria rota faz `getCurrentUser()` + `redirect()` se não houver sessão,
   o mesmo padrão que `AuthenticatedAppLayout` já usa, só que localmente. Um
   banner fino e fixo no topo (status da ativação + link de volta) substitui
   a sidebar — chrome mínimo, não chrome nenhum, porque "CTA claro de
   retorno/publicação" (escopo do SET-36) exige alguma affordance de volta,
   e a barra fina não altera a largura/breakpoints do conteúdo abaixo dela.
4. **Duplicar o JSX da página pública na rota de preview.** Rejeitada:
   igual ao raciocínio já usado para `FeedbackPrompt` (ADR-069/070) — duas
   cópias de markup divergem cedo ou tarde. Escolhido: extrair
   `CommercialPageContent` (`modules/representatives/presentation/`) de
   dentro de `[productSlug]/page.tsx`, consumida pelas duas rotas. A página
   pública perde só a orquestração (resolução por Host, analytics `after()`);
   o conteúdo em si — bloco de identificação, WhatsApp, abas de produto,
   formulário de lead, aviso de compliance — é literalmente o mesmo
   componente nas duas rotas, não duas versões independentes.
5. **`LeadForm` funcionar de verdade dentro do preview.** Rejeitada, e não
   por escolha de escopo — por impossibilidade sem reabrir uma decisão de
   segurança já fechada: `/api/leads` resolve o destino pelo `Host` da
   requisição (`resolveRepresentativeActivation`, só `published`, SET-21/
   ADR-065/068). O preview roda no domínio do próprio SETNAR
   (`setnar.com`/`localhost`), nunca no subdomínio do representante — uma
   submissão real do preview sempre resolveria a `null` e devolveria 404.
   Reescrever a regra canônica de acesso público para reconhecer "dono
   olhando o próprio rascunho" ampliaria uma superfície de segurança que
   SET-21 existe justamente para manter estreita, por um ganho que o próprio
   SET-36 não pede. Escolhida: `LeadForm` ganha uma prop `disabled` — todo
   campo e o botão de envio ficam desabilitados, com uma nota curta
   explicando o motivo, no lugar de deixar o formulário parecer quebrado.
   `WhatsappCta` não precisou do mesmo tratamento: o link `wa.me` é montado
   inteiramente no cliente a partir de `representative.phone`, sem nenhuma
   resolução por `Host` — funciona no preview exatamente como na página
   real. Só o beacon de analytics (`/api/track-click`) falharia, e isso já é
   best-effort, silenciosamente descartado por desenho (ver o próprio
   comentário de `trackWhatsappClick`).

#### Decisão

**Sem migration nova.** `RepresentativeRepository` ganha
`findOwnActivation(profileId, productSlug)`, retornando um novo tipo,
`OwnCommercialPageActivation` (`RepresentativeActivation` + `status`) —
`status` importa aqui (o preview precisa mostrar rascunho/publicado/
despublicado), mas nunca no caminho público (`findPublishedActivation`
sempre resolve `'published'` por construção do filtro). Implementado em
`SupabaseRepresentativeRepository` sobre `product_activations_select_own`
já existente, com o mesmo padrão de "RLS é a fronteira real, o `.eq(...)`
explícito é só declaração de intenção" que `SupabaseRepresentativeAccountRepository`
já usa. `InMemoryRepresentativeRepository` ganha a mesma capacidade para
testes unitários, com `profileId` adicionado às linhas de fixture.

**Nova rota raiz**, `src/app/pre-visualizacao/[productSlug]/page.tsx` — fora
de `src/app/app/`, auth própria, `robots: { index: false, follow: false }`,
banner fixo fino (status da ativação via `STATE_BADGE`, agora exportado de
`activation-view-state.ts`, + link de volta para `/app/paginas`) e o mesmo
`CommercialPageContent` que a página pública renderiza, com
`leadFormDisabled`. Estado "produto nunca ativado" (`findOwnActivation`
retornou `null`) é uma tela própria, não um `notFound()` genérico — o
representante autenticado recebe orientação acionável, não uma parede.

**Link de entrada** — `ProductActivationCard` ganha um botão "Ver prévia"
para qualquer estado além de `not_activated`, incluindo `published`: o
representante pode querer conferir a página já publicada da mesma forma que
um rascunho.

**Nenhuma escrita nesta rota.** Preview é puramente leitura — não existe
nenhum botão de publicar/despublicar/ativar nela; a única ação é o link de
volta para `/app/paginas`, onde essas ações já existem
(`ProductActivationCard`). Isso por si só já satisfaz o critério de aceite
"preview não altera status nem `published_at`" — não há superfície de
escrita para violar essa invariante, não é preciso validar em runtime que
nenhuma escrita aconteceu.

#### Consequências

- Zero migration nova; toda a superfície de leitura já auditada por
  ADR-063/`20260805000000` permanece inalterada.
- `[productSlug]/page.tsx` fica menor e mais legível — orquestração
  (resolução por Host, `after()` de analytics) separada do conteúdo em si.
- `LeadForm` ganha uma segunda forma de uso (`disabled`), documentada no
  próprio componente — SET-61/62/63 nunca a usam, continuam exatamente como
  estavam.
- `STATE_BADGE` sai de `activation-view-state.ts` como export nomeado —
  qualquer superfície futura que precise do mesmo par label/tom por estado
  de ativação reusa o mesmo dicionário, em vez de reinventar a cópia.
- Risco aceito e monitorável: `CommercialPageContent` é agora consumida por
  duas rotas; qualquer mudança futura na página pública passa a afetar o
  preview automaticamente — o comportamento desejado (são "a mesma página"),
  mas motivo para os dois `page.tsx` finais ficarem finos de propósito, sem
  lógica própria de conteúdo escondida em nenhum dos dois.

#### Rollback conceitual

Migrations são forward-only e nenhuma foi criada aqui. Uma reversão seria
puramente de aplicação: remover `src/app/pre-visualizacao/`, o botão "Ver
prévia" em `ProductActivationCard`, e `findOwnActivation` do repositório —
`product_activations_select_own` continuaria existindo (decisão de
ADR-063/SET-10, não desta), simplesmente sem este consumidor.
