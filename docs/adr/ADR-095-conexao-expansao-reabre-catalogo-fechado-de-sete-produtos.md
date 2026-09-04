### ADR-095 — Conexão Expansão reabre o catálogo fechado de sete Produtos; ADR-089 permanece válida quanto a árvores independentes

**Status:** Accepted

**Date:** 2026-09-04

**Related:** Qualifies ADR-089 (não a supersede — sua decisão principal, árvores de apresentação independentes, é reafirmada, não revertida); qualifies a premissa de catálogo fixo de `supabase/migrations/20260803000000_seed_igreen_catalog.sql`; preserva ADR-060 (vocabulário `Representative`/"licenciado"); registrado a partir de `docs/plans/CONEXAO_EXPANSAO_PLAN.md` (investigação inicial, veredito `NO_GO`) e `docs/plans/CONEXAO_EXPANSAO_PLAN_V2.md` (reinvestigação, veredito `GO WITH CONDITIONS`).

#### Contexto

O catálogo iGreen foi semeado com exatamente sete Products
(`20260803000000_seed_igreen_catalog.sql`), e ADR-089 justificou manter sete
árvores de apresentação independentes — em vez de um shell/registry
compartilhado (ADR-088, revertida no mesmo dia) — citando explicitamente
"este conjunto fechado de sete Produtos" como parte do racional: o custo de
duplicar markup/CSS por Produto era aceito porque o conjunto era conhecido e
não crescia.

O Product Owner decidiu adicionar um oitavo Product, Conexão Expansão —
conteúdo sobre o programa de bonificação por conectar novos licenciados à
rede iGreen, hoje descrito em `docs/igreen/conexao-expansao.txt` (material de
referência fornecido pelo Product Owner, **não verificado de forma
independente contra a iGreen Academy autenticada** — ver
`CONEXAO_EXPANSAO_PLAN_V2.md` §3). Duas questões precisavam de decisão
explícita antes de qualquer código: (1) se a premissa de "catálogo fechado em
sete" ainda vale, e (2) se uma Commercial Page pode, por definição de
domínio, ter como público um potencial novo Representative — não apenas o
cliente final de um Representative já existente.

#### Alternativas consideradas

1. **Recusar o oitavo Product, mantendo o catálogo fechado em sete.**
   Rejeitada pelo Product Owner — decisão de produto tomada em
   `CONEXAO_EXPANSAO_PLAN_V2.md`, não revisitada aqui.
2. **Reabrir o catálogo E reintroduzir um template/registry compartilhado**
   (voltar a ADR-088) para tornar a adição do 8º e de futuros Products mais
   barata. Rejeitada: nenhuma evidência concreta de que o dispatcher atual
   (`switch` de sete linhas) criou um problema real (`CONEXAO_EXPANSAO_PLAN_V2.md`
   §8) — o único risco documentado já observado (ADR-089) aponta na direção
   contrária, de que abstrair reduz fidelidade visual por Produto. Generalizar
   a arquitetura com base em "agora são oito" sem essa evidência seria
   exatamente a abstração prematura que ADR-089 já rejeitou.
3. **Reabrir apenas a premissa numérica do catálogo, preservando toda a
   decisão de composição de ADR-089.** Escolhida.

#### Decisão

**A. ADR-089 permanece válida integralmente quanto à composição de página:**
cada Product possui sua própria árvore de apresentação e estilos, sem shell
visual obrigatório, sem `CommercialPageContent`, sem registry genérico de
conteúdo. `dispatch-commercial-page.tsx` continua sendo um `switch` explícito
por slug — não um renderer dinâmico. Continuam únicos e compartilhados,
exatamente como ADR-089 já definia: resolução de Company/Representative/
Product por Host+slug, o caminho seguro de submissão de Leads, registro de
analytics e metadata/Open Graph, política de privacidade e o aviso de
independência da SETNAR.

**B. A premissa de "catálogo fechado em exatamente sete" deixa de valer.**
O catálogo pode crescer por decisão de produto explícita — como esta —
registrada em ADR, nunca por inferência de código ou por conveniência de
implementação. `conexao-expansao` é adicionado como oitavo slug, via
migration aditiva (`supabase/migrations/20260904170153_add_conexao_expansao_product.sql` —
o timestamp reflete o momento real da aplicação via `mcp__supabase__apply_migration`,
não um valor escolhido a dedo; o arquivo foi renomeado para bater com o
registrado em `supabase_migrations.schema_migrations` do projeto de teste,
evitando drift entre o histórico local e o remoto),
sem editar `20260803000000_seed_igreen_catalog.sql` (migration já aplicada —
regra de nunca editar migration aplicada, preservada). O comentário de
"catálogo fixo de 7 linhas" naquele arquivo permanece — é histórico e correto
para o que aquela migration fez; não é reescrito para "8", porque não é mais
verdadeiro sobre o catálogo como um todo, apenas sobre o que aquela migration
especificamente inseriu.

**C. Uma Commercial Page pode ter como público um consumidor final OU um
potencial novo Representative interessado na oportunidade comercial.**
Modelo: `Representative → Commercial Page → interessado → conversão/WhatsApp`,
generalizando o modelo anterior implícito
(`Representative → consumidor final → interesse em produto/serviço`). Isso
não introduz uma nova entidade de domínio — `Lead`, `Commercial Page` e
`Product` já não assumiam, em sua definição textual, que o visitante fosse
necessariamente um comprador (`CONEXAO_EXPANSAO_PLAN_V2.md` §4 documenta essa
leitura em detalhe, achado por achado). Não é criada uma entidade
`ProspectiveRepresentative` — é um papel do Lead/Visitante nesta instância,
não um conceito de domínio comprovadamente necessário.

#### Consequências

- Um novo Product sem árvore de apresentação própria continua falhando
  fechado (nenhum fallback genérico no dispatcher) — essa garantia de
  ADR-089 não muda.
- Correções verdadeiramente comuns entre os agora oito Products continuam
  exigindo oito alterações e oito validações — custo já aceito por ADR-089,
  agora aplicado a um conjunto de oito, não sete.
- `docs/DOMAIN_MODEL.md` recebe duas edições mínimas (não uma remodelagem):
  um segundo exemplo ilustrativo em **Product** (§8.4) cujo "sellable unit" é
  a própria oportunidade comercial, e "prospective Representative" nomeado no
  glossário ao lado de "the Representative's customer" — ambas descritas em
  detalhe em `CONEXAO_EXPANSAO_PLAN_V2.md` §4/§12.
- `docs/PRODUCT.md` recebe, no máximo, uma atualização factual em "What
  Exists Today" — nenhuma reformulação do Core Domain, que continua sendo
  Commercial Presence & Representative Enablement.
- `product-compliance-notice.ts` **não** é alterado por esta decisão: essa
  mecanismo não é, na prática, consumido por nenhuma das sete árvores
  existentes (`ComplianceNotice`/`getProductComplianceNotice` não têm
  nenhum import fora do próprio módulo — achado desta implementação, não
  descrito nas investigações anteriores). Cada árvore de página, incluindo a
  nova, carrega seu próprio texto de rodapé como prop literal de
  `CommercialPageFooter`, seguindo o padrão real já em uso pelas sete.
- `COMPLIANCE DISCLAIMER SOURCE: UNRESOLVED` permanece como condição de
  **publicação**, não de implementação — ver `CONEXAO_EXPANSAO_PLAN_V2.md` §1
  e §14. Esta ADR não a resolve.
- Nenhum valor financeiro exato (R$, %, tabelas de royalties) é publicado na
  página pública desta implementação — decisão de produto tomada
  separadamente (ver instruções de implementação, item 3), consistente com o
  achado de `CONEXAO_EXPANSAO_PLAN_V2.md` §3 de que a própria iGreen, em suas
  páginas públicas, também não publica esses valores.

#### Rollback conceitual

Reversão é aditiva-inversa e não requer rollback de banco: remover a 8ª
`case` do dispatcher, remover a árvore `conexao-expansao/`, e — se o Product
Owner decidir remover o Product do catálogo — uma migration nova que
desative (nunca apague) a linha em `products`, preservando qualquer
`product_activations`/`leads` histórico que já a referencie, pelo mesmo
princípio que rege a desativação de qualquer outro Product deste catálogo.
`docs/DOMAIN_MODEL.md`/`docs/PRODUCT.md` revertem para o texto anterior a
esta ADR.
