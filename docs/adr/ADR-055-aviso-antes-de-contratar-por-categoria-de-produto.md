### ADR-055 — Aviso "Antes de contratar" por categoria de Produto, e o disclaimer "não é canal oficial" que faltava na Commercial Page

**Achado, confirmado por investigação, não hipotético.** A Commercial Page
real (`src/app/[productSlug]/page.tsx`) não tinha nenhum aviso obrigatório ao
consumidor — nem o "Antes de contratar" que os templates estáticos de
`templates/commercial-pages/` têm (só `ConexaoGreen/index.html` tinha algo
parecido; os outros seis templates, não), nem o disclaimer "não é canal
oficial" que o README já promete para SETNAR, na seção "Compliance" acima
("*A permanent legal notice sits in the footer* [...] *When commercial pages
ship, that per-page identification becomes a publication precondition, not a
template detail*"). Confirmado que esse segundo disclaimer não existia em
lugar nenhum do app fora do footer de `src/app/page.tsx`: `Footer`
(`shared/layout/footer.tsx`) só é renderizado ali, nunca em
`[productSlug]/page.tsx` — os dois usam portas de resolução completamente
diferentes (`resolveTenant`/`MarketingContent` vs. `RepresentativeRepository`,
ADR-031), então um nunca herdava o outro por acidente. Isso não era só falta
de polish visual (já documentado, deliberado, em `DESIGN_SYSTEM.md`) — é uma
exposição de compliance real: o Manual de Conduta da iGreen, item 19.3,
exige "prestar todas as informações ao consumidor antes da contratação".

**Decisão — conteúdo legal versionado como código, não uma coluna nova.**
`src/modules/representatives/domain/product-compliance-notice.ts` exporta
`PRODUCT_COMPLIANCE_NOTICE`, um `Record<slug, texto>` cobrindo os 7 slugs de
`20260803000000_seed_igreen_catalog.sql`, e uma função `getProductComplianceNotice`
que devolve `null` para qualquer slug fora do mapa (nunca um texto adivinhado).
Nenhuma coluna nova em `products`: mesmo raciocínio já registrado no cabeçalho
daquela migration para por que o catálogo é uma migration e não um script —
texto legal revisável por diff/PR, não editável em runtime. `ComplianceNotice`
(`src/modules/representatives/presentation/compliance-notice.tsx`) é o único
componente novo, renderizado em `[productSlug]/page.tsx` logo abaixo do
`LeadForm` — `Text variant="caption"` simples, sem `Card`, mesmo tratamento
visual que `Footer` já dá ao seu próprio `legalNotice` ("discreto, mas sempre
visível", não um banner de alerta).

**Uma categoria por texto, não um texto por produto.** Os 7 slugs agrupam em
3 bases regulatórias distintas, cada uma com sua própria fonte:
  - **Energia** (`conexao-green`, `conexao-solar`, `conexao-livre`,
    `conexao-placas`) — Manual de Conduta iGreen, item 19.3.
  - **Seguros** (`green-seguros`) — "Green Seguros.md", §9.3/§10.3: BP
    Seguradora S.A. como responsável pela apólice, regulada pela SUSEP,
    indenização por Tabela FIPE.
  - **Telecom/Club** (`telecom`, `conexao-club`) — **sem fonte específica no
    Manual de Conduta para nenhum dos dois.** Texto genérico baseado no CDC,
    aprovado pelo Pedro como placeholder provisório, **não revisado pelo
    jurídico da iGreen.** Tratar como o texto mais fraco dos três — o único
    sem base regulatória citável — e revisitar assim que houver fonte real.

**O disclaimer "não é canal oficial" é duplicado do `setnar.tenant.ts`, não
importado.** `NOT_OFFICIAL_CHANNEL_NOTICE` (mesmo arquivo) repete, ao pé da
letra, o texto que `FooterContent.legalNotice` já carrega para a página do
SETNAR — mesma razão pela qual `representative-rules.ts` já duplica
`BR_PHONE_PATTERN` em vez de importar de `leads`: a Commercial Page nunca
passa por `resolveTenant`/`MarketingContent`, e importar através dessa
fronteira por uma única string acoplaria `representatives` a
`marketing`/`tenancy` sem necessidade. Manter os dois em sincronia à mão se o
texto mudar.

**Teste — no mesmo nível dos testes já existentes no projeto, não um nível
novo.** Este projeto não tem infraestrutura de teste de renderização React
(sem `@testing-library/react`, sem `jsdom` — todo teste em `tests/` hoje é
`node:test`/`assert` contra função pura). `ComplianceNotice` é um render
incondicional do que as duas exportações acima devolvem, então o risco real —
o texto errado aparecendo para o produto errado — mora inteiramente no
mapeamento, não no JSX. `tests/product-compliance-notice.test.ts` testa
`PRODUCT_COMPLIANCE_NOTICE`/`getProductComplianceNotice` diretamente (os 4
casos: energia, seguros, telecom, club), no mesmo padrão de
`representative-rules.test.ts` — sem introduzir uma convenção de teste nova
para isto.

**Não implementado neste passo, de propósito.** Metadados por página
(`generateMetadata`/OG image) e o gap maior de visual on-brand/calculadora por
produto — o segundo precisa de investigação própria (mudança de schema,
decisão de produto sobre o design system) antes de qualquer código.

**Custo de reversão.** Baixo — um componente sem estado e um arquivo de
constantes; nenhuma tabela, coluna ou migration.

---
