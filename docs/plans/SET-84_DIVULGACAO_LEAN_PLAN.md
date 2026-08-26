# SET-84_DIVULGACAO_LEAN_PLAN.md

> Plano de investigação — versão enxuta de SET-84 ("Transformar Materiais em
> fluxo de Divulgação com atribuição de origem"), complementando o MVP.
> Escopo: mapear a Issue contra a arquitetura real, confirmar que não há
> impeditivo técnico, e fechar as decisões de produto que a própria Issue
> deixa em aberto para uma "rodada enxuta". Nenhuma implementação acontece a
> partir deste documento sozinho.

**Status:** Approved — D1–D5 fechados por Pedro em 2026-08-26 (D1/D2 como propostos; D3 e D5 aprovados com ajuste — lista canônica em TypeScript, não ENUM/duplicação SQL, e breakdown visitas+leads lado a lado; D4 alterado — `/app/divulgacao` como rota nova, não extensão de `/app/paginas/marketing`). Nada implementado ainda.
**Authority:** Non-normative (ver `docs/plans/README.md`)
**Code baseline:** `a8ab2de`, branch `develop`, 2026-08-26
**Last reviewed:** 2026-08-26
**Superseded by:** —

> **Este plano NÃO é uma especificação final e NÃO autoriza implementação.**
> Itens marcados `DECIDIDO` registram uma decisão do Pedro já tomada (nesta
> revisão). Itens marcados `EM ABERTO` continuam exigindo aprovação antes de
> qualquer código ser escrito.

---

# 0. Veredito da investigação

**Sem impeditivo técnico.** A arquitetura atual sustenta a feature quase
inteira, e boa parte do "kit pronto" que a Issue pede **já existe**, entregue
pela SET-65 (`MARKETING_MATERIALS_PLAN.md`, implementada):

- `/app/paginas/marketing` (`MarketingMaterialsPage`) já lista só produtos
  publicáveis do representante, pela mesma regra canônica de `/app/paginas`
  (`selectAvailableProductsWithMaterials` → `getActivationViewState`).
- Cada material já sai personalizado com QR Code embutido
  (`buildMarketingMaterialPropsWithQrCode`) apontando para
  `buildCommercialPageUrl(representative, product)` — a mesma derivação
  canônica de URL pública usada em todo o app.
- Os 21 materiais (7 produtos × post/story/poster) já existem em
  `marketing-materials/registry.ts`.

A única lacuna real é exatamente a que a própria Issue já nomeia —
**atribuição de origem** — e ela foi confirmada lendo o código, não assumida:

- `analytics_events` (`20260810000000_add_analytics_events.sql`) não tem
  coluna de origem.
- `record_page_visit`/`record_whatsapp_click`
  (`20260811000000_add_analytics_write_functions.sql`) não recebem
  `p_origin` — só `representative_slug`, `product_slug`, `referrer`,
  `ip_hash`, `user_agent`.
- `submit_lead` (`20260821000000_apply_canonical_access_to_leads.sql`) tem um
  campo `p_origem`, mas ele já está ocupado — é a superfície de captura
  (`origem: 'commercial_page'`, escrito por `commercial-lead-form.tsx`), não
  o canal de divulgação. Precisa de um campo novo, separado.
- `[productSlug]/page.tsx` não lê `searchParams` hoje — não há como um
  `?src=` chegar a lugar nenhum.
- `whatsapp-cta.tsx` rastreia o clique (`trackWhatsappClick`) só com
  `document.referrer`, nunca com a origem da visita.

Nada disso esbarra em RLS, ownership, tenancy ou nas regras já fechadas
(ADR-050/051/053/065/067/068) — é extensão do mesmo desenho, seguindo
exatamente a "Ordem de implementação — não pular" da própria Issue.

Achado lateral, sem relação com a decisão de implementar ou não:
`docs/analytics/VALIDATION_FUNNEL_PRODUCTION_REPORT.md` — o relatório que a
Issue cita como já tendo recomendado o `?src=` — existe no working tree mas
está **untracked** (`git status`), nunca foi commitado. Registrado aqui para
decisão separada do Pedro; não bloqueia este plano.

---

# 1. Contrato de origem

`OriginId` — o mesmo enum de 5 valores que a Issue já fecha:

```
instagram_post | instagram_story | whatsapp | qrcode | direct
```

**Validação sempre no servidor, nunca confiando no cliente** — mesmo padrão
de `is_bot_user_agent`: uma função `sql immutable` nova,
`is_valid_origin(text)`, chamada de dentro de `record_page_visit`,
`record_whatsapp_click` e `submit_lead`. Um valor fora da allowlist não
rejeita a chamada (não quebra a página) — degrada para `null`, exatamente
como a Issue exige.

`origin` é **nullable** nas duas tabelas (`analytics_events`, `leads`) — um
fluxo sem `?src=` continua funcionando sem regressão (requisito explícito da
Issue), simplesmente grava `null`.

## 1.1 Isto é atribuição de entrada da visita atual, não um modelo de attribution/campaign — `DECIDIDO` (Pedro, 2026-08-26)

Registrado explicitamente para que ninguém no futuro leia esta escolha como
arquitetura definitiva: `origin` captura **o mecanismo/link pelo qual a
visita entrou nesta página, nesta visita** — não um modelo de campanha, não
sessão, não multi-touch attribution. `channel`, `campaign`, `creative` são
dimensões diferentes, que este MVP explicitamente não introduz (a Issue já
exclui entidade `Campaign` completa).

**Caso limite aceito, e documentado aqui para não ser lido como bug:** um
material de Instagram Post que contém o QR Code do produto (SET-65) — se
alguém escaneia esse QR a partir do post, a visita grava `origin = 'qrcode'`,
não `instagram_post`. Isto é uma limitação real de granularidade (o `origin`
descreve o mecanismo de entrada imediato — o link que o navegador de fato
seguiu — não o contexto completo de exposição que levou até ele), aceita
conscientemente nesta rodada para não introduzir `channel` + `medium` +
`campaign` separados. Qualquer leitura futura de `origin` deve tratá-lo como
"por qual link/mecanismo a pessoa entrou", não como "attribution de
marketing completo".

## 1.2 Como a origem chega do clique/lead até a RPC — `EM ABERTO`, recomendação abaixo

A visita chega com `?src=` na URL. O clique no WhatsApp e o envio do lead
acontecem depois, no mesmo carregamento de página, mas em componentes client
diferentes (`WhatsappCta`, `CommercialLeadForm`) dentro de uma das 7 árvores
de apresentação independentes (ADR-089).

**Recomendação: resolver e validar a origem uma única vez no Server
Component (`[productSlug]/page.tsx`), e passá-la como prop através da mesma
cadeia que já carrega `representative`/`product` até `DispatchCommercialPage`
e as 7 árvores.** Não introduzir cookie, `sessionStorage` nem re-leitura de
`window.location` no cliente — o servidor já validou a origem uma vez nesse
mesmo request, e ela só precisa sobreviver dentro da mesma árvore de
componentes já renderizada, não entre navegações. `WhatsappCta` inclui
`origin` no corpo do POST para `/api/track-click`; `CommercialLeadForm`
inclui `origin` no corpo do POST para `/api/leads`. Ambas as rotas
revalidam a atribuição por Host+slug do jeito que já fazem hoje — o `origin`
só percorre o mesmo caminho que `productSlug` já percorre, nunca decide
ownership sozinho.

Custo: tocar as 7 árvores de apresentação para passar `origin` adiante até
onde `WhatsappCta`/formulário de lead já são renderizados — mecânico, sem
lógica nova por árvore.

---

# 2. Decisões

## D1 — Escopo de canais e origem — `DECIDIDO` (já fixado pela própria Issue)

4 canais na UI (Instagram Post, Instagram Story, WhatsApp/Status, Link
direto/QR Code) mapeando para os 5 `OriginId`. O card "Link direto/QR Code"
cobre dois `OriginId` diferentes conforme a ação: `Copiar link` grava o link
com `?src=direct`; o QR Code do material (já embutido, SET-65) passa a
carregar `?src=qrcode` na URL que ele codifica.

## D2 — Catálogo de copy/CTA por canal — `DECIDIDO` (Pedro, 2026-08-26)

**Não 28 textos (7 produtos × 4 canais). 4 templates, um por canal**, com
`productName` e o link rastreável interpolados. Objetivo desta rodada é
validar se material+texto+CTA+link prontos aumentam a execução de
divulgação — não otimizar copy por produto.

Estrutura, para não fechar a porta a uma sobrescrita futura por
produto×canal sem alterar fluxo/UI:

```ts
type OriginId = 'instagram_post' | 'instagram_story' | 'whatsapp' | 'direct' | 'qrcode';

interface DivulgacaoCopyParams {
  readonly productName: string;
  readonly link: string;
}

interface DivulgacaoCopy {
  readonly text: string;
  readonly cta: string;
}

// Fallback canônico desta versão: um template por canal, aplicado a
// qualquer produto. `productSlug` já está na assinatura para que uma
// sobrescrita futura (ex.: um Record<productSlug, Partial<Record<OriginId,
// (params) => DivulgacaoCopy>>>) plugue sem mudar quem chama esta função.
function resolveDivulgacaoCopy(
  origin: OriginId,
  productSlug: string,
  params: DivulgacaoCopyParams,
): DivulgacaoCopy | null;
```

Nenhum motor de templates genérico, editor ou IA — só uma função pura com 4
entradas fixas (`qrcode`/`direct` não precisam de copy social, só
link/QR). `productSlug` é aceito e ignorado nesta rodada — sem nenhum mapa de
overrides ainda, só o parâmetro já presente na assinatura para a extensão
futura não exigir mudar a interface.

## D3 — Migrations — `DECIDIDO — aprovado com ajuste` (Pedro, 2026-08-26)

Direção aprovada: `origin text` nullable nas tabelas existentes (sem tabela
`origins`, sem tipo `ENUM` do Postgres — um `ENUM` parece elegante agora mas
é mais rígido para evoluir valores; `text` + `check` já é reversível sem
`ALTER TYPE`), validação server-side, dois conceitos mantidos separados
(`leads.origem` continua sendo a superfície de captura — `commercial_page` —
e `origin`, novo, é o canal de divulgação).

**Ajuste em relação à proposta original: uma única lista canônica, não a
mesma lista duplicada e mantida manualmente em vários lugares.**

- **Fonte canônica: TypeScript**, um único array/union exportado (ex.:
  `src/modules/analytics/domain/origin.ts`, `ORIGIN_IDS` +
  `type OriginId = typeof ORIGIN_IDS[number]`) — é dali que a UI, os
  templates de copy (D2) e os payloads das rotas derivam os valores válidos.
- **A constraint SQL (`check` nas duas tabelas + `is_valid_origin(text)`
  usada pelas três RPCs) continua existindo — não é removida —, mas como
  barreira de integridade, não como segunda fonte de verdade.** A allowlist
  em SQL é escrita a mão nas migrations (SQL não importa TS), então listada
  explicitamente lado a lado com o array TypeScript nesta seção, para
  qualquer PR futuro que adicione uma origem comparar as duas.
- **Teste de sincronização obrigatório** (ex.:
  `tests/origin-allowlist-sync.test.ts`): lê `ORIGIN_IDS` do TypeScript e a
  lista literal esperada em SQL (hardcoded no teste, pareada manualmente com
  a migration mais recente) e falha se divergirem — closes exatamente o
  risco que o Pedro apontou ("caça a enums em SQL, TypeScript, schemas e
  testes" quando um canal novo for adicionado). Adicionar uma origem nova
  passa a ser: 1) editar `ORIGIN_IDS`, 2) nova migration com a constraint
  atualizada, 3) o teste força os dois a baterem antes de mergear — não uma
  arqueologia por várias camadas.

Migrations propostas (nenhuma aplicada é editada):

1. `add_origin_to_analytics_events.sql` — coluna `origin text` nullable +
   `check (origin is null or origin in (...))`, mesmo padrão de `event_type`.
2. `add_origin_to_leads.sql` — mesma forma, em `leads`.
3. `add_origin_write_functions.sql` — `is_valid_origin(text)` +
   `create or replace` de `record_page_visit`, `record_whatsapp_click` e
   `submit_lead` aceitando `p_origin`, revoke/grant explícitos preservados
   (mesma disciplina do ADR-048).

## D4 — Superfície "Divulgação" — `ALTERADO — DECIDIDO` (Pedro, 2026-08-26)

**Discordância de produto em relação à recomendação original, aceita.**
Estender `/app/paginas/marketing` era a opção tecnicamente mais barata, mas
"materiais das páginas" e "quero divulgar o que vendo" são dois jobs
diferentes que só compartilham infraestrutura — empilhar Canais/Texto/
Resultados dentro de `Páginas → Marketing` cria uma hierarquia que precisaria
ser desmontada depois.

**Decisão: nova rota `/app/divulgacao`, nova entrada "Divulgação" em
`AppNavigation` (`app-navigation.tsx`), como superfície de produto
independente — sem criar um novo bounded context de domínio.** A
distinção que rege a implementação: *nova superfície de produto ≠ nova
arquitetura de domínio*. `/app/divulgacao` é composição/orquestração de
apresentação sobre módulos que já existem e não são duplicados:

- `marketing-materials` (catálogo, registry, `buildMarketingMaterialPropsWithQrCode`)
- `selectAvailableProductsWithMaterials` / regra canônica de disponibilidade
- `buildCommercialPageUrl`
- `analytics` (leitura, D5)
- `leads` (submissão existente)
- os 4 templates de copy (D2)

Fluxo de tela (contrato funcional, não especificação visual final):

```text
Divulgação
  → "O que você quer divulgar?" — grid de produtos disponíveis (mesma regra
     de disponibilidade já usada em /app/paginas e /app/paginas/marketing)
  → "Como você quer divulgar?" — Instagram Post / Instagram Story /
     WhatsApp / Link/QR Code
  → "Seu material está pronto" — preview do material (SET-65) + texto (D2)
     + Copiar texto / Baixar material / Copiar link / Compartilhar
```

**Nenhum módulo `src/modules/divulgacao/domain|application|infrastructure`
nasce nesta rodada** — só entra código próprio de apresentação/orquestração
(a rota, os componentes de seleção de produto/canal) se e quando a
implementação mostrar que ele não cabe em nenhum módulo existente. Mesmo
critério que `MARKETING_MATERIALS_PLAN.md` D4 já aplicou: camadas nascem de
responsabilidade real, não por espelhamento.

**`/app/paginas/marketing` (SET-65) fica como está nesta rodada** — sem
migração grande agora. Redirecioná-la para `/app/divulgacao` (ou aposentá-la)
é uma decisão de UX separada, para depois que `/app/divulgacao` estiver no
ar e validada, não parte deste plano.

## D5 — Resultado mínimo por origem — `DECIDIDO — aprovado com ajuste` (Pedro, 2026-08-26)

Direção arquitetural aprovada como estava: estender
`AnalyticsMetricsRepository`/`aggregateAnalyticsSummary` para agrupar também
por `origin`, reaproveitando as mesmas duas queries (`analytics_events`,
`leads`) já scoped por RLS — sem tabela nova, sem dashboard novo.

**Ajuste de produto: listar visitas e leads lado a lado por origem, não em
duas listas separadas**, para que a pergunta real do licenciado ("o que está
funcionando?") tenha resposta direta:

```text
Origem              Visitas    Leads
Instagram Post          48        4
Instagram Story         17        3
WhatsApp                32        6
QR Code                  4        0
```

Uma taxa de conversão (visita → lead) por origem é **derivada na
apresentação, nunca armazenada** — `leads / visits` calculado no componente
a partir dos dois números que já vêm de `ProductAnalyticsSummary`/sua
extensão por origem, mesmo espírito de "nenhuma coluna nova por conveniência
de leitura" que já rege o resto do schema de analytics.

**Local: uma seção nova, "De onde vieram seus resultados", na tela de
resultados/analytics já existente do representante — não um dashboard de
divulgação novo.** Mantém o MVP enxuto e evita duplicar a superfície que
`AnalyticsMetricsRepository` já alimenta.

**Nomenclatura interna, deliberada:** o conceito passa a ser chamado
**"breakdown by origin"** em código/testes/comentários — nunca "analytics
por canal" como conceito definitivo. `origin` já não é sinônimo de
`channel`/`source`/`campaign` (§1.1); nomear como "canal" cedo demais
correria o risco de essas palavras ficarem coladas uma à outra quando
`campaign`/`creative` existirem de verdade.

---

# 3. Sequenciamento proposto (espelha a "Ordem de implementação" da Issue)

```text
1. Aprovação deste plano (D1–D5) — FECHADO 2026-08-26
2. D3 — migrations de atribuição mínima (schema + RPCs), com
   ORIGIN_IDS (TypeScript) como fonte canônica + teste de sincronização
   com a allowlist SQL
3. Testes de segurança/isolamento/regressão da atribuição (origem inválida,
   ausência de origem, visita→WhatsApp, visita→lead, isolamento entre
   representantes)
4. Wiring de leitura do `?src=` em [productSlug]/page.tsx + threading pelas
   7 árvores até WhatsappCta/CommercialLeadForm (§1.2)
5. D2 — catálogo de 4 copies/CTAs
6. D4 — superfície Divulgação em /app/divulgacao (rota nova, composição de
   módulos existentes — /app/paginas/marketing permanece como está)
7. D5 — breakdown by origin (visitas + leads lado a lado, taxa derivada) na
   tela de resultados existente
8. E2E do fluxo completo
```

A UI (passo 6) não é considerada pronta antes do passo 2–4 estarem
funcionais — mesma regra que a Issue já registra: sem atribuição, divulgação
sem mensuração.

---

# 4. Fora de escopo (desta rodada)

Tudo que a própria Issue já lista como fora de escopo (Meta Ads, publicação
automática, envio em massa, calendário editorial, IA generativa, editor tipo
Canva, entidade Campaign, CRM, automações, analytics avançado, criação livre
de origens pelo usuário) — reafirmado aqui, não relaxado.

Adicional desta rodada enxuta:
- 28 copies específicas por produto×canal (D2) — adiado, arquitetura deixada
  pronta para receber depois.
- Persistência de origem entre navegações/sessões (cookie, `sessionStorage`)
  — a origem só precisa sobreviver dentro do mesmo carregamento de página
  (§1.2).
- Modelo de `channel`/`campaign`/`creative` como dimensões distintas de
  `origin` (§1.1) — `origin` cobre só "por qual link/mecanismo a visita
  entrou" nesta rodada.
- Migrar ou aposentar `/app/paginas/marketing` — permanece como está (D4).
- Decisão sobre commitar `docs/analytics/VALIDATION_FUNNEL_PRODUCTION_REPORT.md`
  — registrada como achado lateral (§0), decisão separada do Pedro.

---

# 5. Critérios de não-overengineering para a implementação

- Não criar entidade `Campaign` nem lifecycle de campanha.
- Não criar Smart QR Code — o QR já existe (SET-65), só o link que ele
  codifica ganha `?src=qrcode`.
- Não criar tabela de origem separada — `origin` é coluna nas duas tabelas
  já existentes, mesmo padrão de `event_type`.
- Não criar tipo `ENUM` do Postgres para `origin` — `text` + `check`, mais
  barato de evoluir; `ORIGIN_IDS` (TypeScript) é a única fonte canônica,
  SQL é barreira de integridade sincronizada por teste (D3).
- Não criar motor de templates genérico para D2 — 4 funções fixas.
- Não criar dashboard novo para D5 — seção nova na tela de resultados já
  existente, extensão da leitura agregada existente.
- Não criar cookie/sessionStorage para propagar origem — thread via props no
  mesmo request (§1.2).
- Não refatorar as 7 árvores de apresentação além de passar a prop `origin`
  adiante.
- Não criar `src/modules/divulgacao/domain|application|infrastructure` nesta
  rodada — `/app/divulgacao` é composição/apresentação sobre módulos
  existentes, só nasce camada própria quando não houver onde encaixar (D4).
- Não migrar/aposentar `/app/paginas/marketing` nesta rodada.
