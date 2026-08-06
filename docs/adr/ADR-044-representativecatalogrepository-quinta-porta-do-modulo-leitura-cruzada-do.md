### ADR-044 — `RepresentativeCatalogRepository`, quinta porta do módulo: leitura cruzada do Catalog da Company com as próprias Product Activations (D5.1)
**Decisão.** `domain/representative-catalog-repository.ts` define
`RepresentativeCatalogRepository.listOwnCatalog(profileId)`, retornando
`RepresentativeCatalogEntry[]` — cada Product da Company do representante,
cruzado com o estado da própria ativação (`not_activated`/`draft`/
`published`/`unpublished`). O adapter `SupabaseRepresentativeCatalogRepository`
roda três leituras (representante próprio → `id`/`company_id`; produtos da
company; ativações próprias) e delega o cruzamento a uma função pura,
`mergeRepresentativeCatalog` (`infrastructure/merge-representative-catalog.ts`),
testável sem cliente Supabase — mesmo padrão dos mapeadores de RPC deste
módulo. Passo D5.1 de `docs/SPRINT_D_PLAN.md`.
**Nenhuma migration nova.** `products_select_public` (`using (true)`,
`20260731000000`) já cobre o catálogo; `product_activations_select_own`
(`20260804000000`/`20260805000000`) já cobre as próprias ativações em
qualquer status, incluindo `draft`/`unpublished`, que a policy pública
esconde. A auditoria que precedeu D5 confirmou isso antes de qualquer código
ser escrito.
**Quinta porta, não um método a mais.** Mesma "naturezas diferentes merecem
portas diferentes" já usada três vezes (ADR-031, ADR-041, ADR-042):
`RepresentativeAccountRepository.findByProfileId` responde "qual é minha
própria linha" (uma tabela, uma linha); `listOwnCatalog` responde "como está
meu Catalog" (duas tabelas, muitas linhas, cruzadas) — adapter e formato de
retorno diferentes o bastante para não caber na mesma implementação sem
forçar `SupabaseRepresentativeAccountRepository` a fazer algo que sua própria
função não pede.
**Teste.** `tests/merge-representative-catalog.test.ts` cobre o cruzamento
puro: produto sem ativação → `not_activated`; produto com ativação → status
repassado; mistura preservando ordem dos produtos; ativação "órfã" (produto
de outra company, que a regra 6 já impede na prática) ignorada; lista vazia;
`unpublished` tratado como qualquer outro status conhecido. As três queries
do adapter em si não têm teste automatizado — mesma lacuna aceita nos outros
adapters deste módulo, coberta por verificação manual (`supabase/README.md`).
**Custo de reversão.** Baixo — arquivo novo, nenhuma tabela/policy tocada;
remover a porta só afeta quem a chama (`src/app/app/page.tsx`,
`RepresentativeHub`).
