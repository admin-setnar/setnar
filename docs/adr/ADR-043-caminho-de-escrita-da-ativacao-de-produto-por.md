### ADR-043 — Caminho de escrita da ativação de produto por duas funções `SECURITY DEFINER`, não por policies de INSERT/UPDATE
**Decisão.** `supabase/migrations/20260807000000_add_product_activation_write_path.sql`
cria `activate_product(p_product_id uuid)` e
`set_activation_status(p_product_id uuid, p_status text)`, ambas
`security definer`, `set search_path = public`, `language plpgsql`,
`returns table (...)`, `revoke ... from public` + `grant ... to authenticated`
(nunca `anon`). Nenhuma policy nova, nenhuma tabela, nenhuma coluna. Passo D4
de `docs/SPRINT_D_PLAN.md`. Do lado do TypeScript: porta
`ProductActivationGateway`, mapeadores puros
(`map-product-activation-result.ts`), adapter e factory, mesmo formato do
ADR-041.
**A lacuna que fecha.** `product_activations` tinha RLS habilitado e SOMENTE
policies de SELECT — nenhum INSERT, UPDATE ou DELETE por caminho nenhum, e
este projeto não tem service role key. Sem isto, quem terminava o onboarding
(D3.B) não conseguia colocar página pública no ar por meio nenhum.
**Por que função e não policy — o argumento que decide.** O plano
(`SPRINT_D_PLAN.md:500-503`) inclinava pela policy "porque o caso não tem o
motivo que gerou as funções anteriores (acesso anônimo)". Isso é razão para a
função não ser obrigatória, não razão para a policy ser melhor. O que decide
é **quem nomeia o representante**: com policy, o cliente TEM que enviar
`representative_id` no corpo do INSERT e a correção depende inteiramente de o
`WITH CHECK` pegar um valor forjado; com função, a assinatura é
`activate_product(p_product_id)` e o representante é derivado de `auth.uid()`
por dentro — o chamador não tem como sequer nomear outro. Mesmo princípio do
`tenant_id` em `handle_new_user()` (ADR-011) e do `company_id` em
`register_representative()` (ADR-040). Três motivos secundários (policy não
expressa transição, porque `USING` vê a linha antiga e `WITH CHECK` a nova sem
que nenhuma veja as duas; policy não mantém `published_at` sem trigger; e ler
`representatives` de dentro de uma policy de `product_activations` é a forma
que a regra operacional do ADR-039 proíbe) estão detalhados no cabeçalho da
migration, junto da contagem de objetos que cada rota exigiria.
**Reconciliação registrada antes de desenhar qualquer checagem.**
`DOMAIN_MODEL.md` descreve dois ciclos que parecem concorrentes e o schema
materializa um só: §8.5 "Product Activation" (linha 357) tem
"Activated → Deactivated", enquanto Draft/Published/Unpublished é de §8.6
"Commercial Page" (linha 368) e §14.1. Ou seja, `product_activations.status`
materializa a máquina de estados da **Commercial Page** sobre a linha da
**Product Activation**: **neste código, uma Commercial Page É uma linha de
`product_activations` com `status = 'published'`** — não existe tabela
`commercial_pages`, e `findPublishedActivation` resolve a página direto de uma
linha. Consequência que economiza uma checagem: a precondição "ao menos um
Product ativado" (regra 10, `DOMAIN_MODEL.md:371`) é satisfeita por
construção, porque a linha publicada É a ativação. A leitura errada teria
produzido um `exists` inútil.
**Máquina de transições.** `activate_product` é o único caminho que cria
linha, sempre em `draft`; `set_activation_status` só aceita `published` ou
`unpublished` como alvo. `draft → published` e `unpublished → published`
passam pelo gate; `published → unpublished` é sempre permitida;
`draft → unpublished` é rejeitada (`invalid_transition`, seguindo
`DOMAIN_MODEL.md:649`); qualquer destino `draft` é rejeitado
(`invalid_status`). Mesmo-estado é **sucesso idempotente sem escrita**, não
erro — mesma razão do trabalho de TOCTOU do ADR-040: duplo clique e retry de
rede são comuns. `activate_product` é idempotente pela mesma lógica e, quando
a linha já existe, **não toca em `status`** — reativar um produto já
publicado não pode rebaixá-lo para `draft` e tirar a página do ar.
**Gate de publicação, granular e em ordem deliberada.** Três precondições,
verificadas nesta ordem, e a primeira que falhar é a reportada:
`representatives.status = 'active'` → `representative_not_active`;
`display_name` não vazio após trim → `display_name_required`; `phone` não
vazio após trim → `phone_required`. Razão própria por precondição, e não um
"não é possível publicar" genérico, porque a UI de D5.2 precisa saber
exatamente o que pedir ao representante para corrigir. A ordem importa: um
representante suspenso não deve receber "preencha seu telefone" como
orientação. `phone` é exigido porque sem ele `WhatsappCta` não renderiza
(ADR-035) e uma Commercial Page sem CTA não é uma Commercial Page.
**Dois desvios conscientes no gate**, registrados aqui e não descobertos
depois: `avatar_url` NÃO é exigido, desvio explícito da regra 7 — não existe
Storage, não existe upload e nada renderiza esse campo, então exigir uma foto
que ninguém consegue enviar tornaria a publicação impossível; e Subscription
ativa NÃO é checada (regra 21, `DOMAIN_MODEL.md:650`) — é D7, e publicar aqui
ignora cobrança por completo, que é o estado conhecido de hoje e não uma
regressão desta migration.
**Regra 4 (Retired Product) é inaplicável, não esquecida.**
`DOMAIN_MODEL.md:348` diz que um Product retirado não pode ser ativado, mas
`products` não tem coluna de status e `20260731000000:70-77` registra que esse
ciclo foi deliberadamente não modelado. `activate_product` não checa isso
porque não há o que checar; criar a coluna é decisão de outra migration.
**`published_at`: primeira publicação, nunca sobrescrito, nunca anulado.**
Setado no primeiro `→ published` (via `coalesce`); republicar não o atualiza;
despublicar não o anula. Sem precedente no projeto, então o raciocínio fica
registrado: isso torna `published_at is not null` um fato durável ("já foi
pública alguma vez"), que é exatamente o que a regra 12 (`DOMAIN_MODEL.md:565`,
o slug não deve mudar depois de publicado) precisa para algum dia ser
exequível, e nada mais no schema o registra. Sobrescrever destruiria
informação de forma irreversível; manter perde apenas um "no ar desde X", que
uma migration futura pode adicionar como coluna própria. Entre uma escolha
reversível e uma irreversível, sem consumidor para nenhuma das duas hoje, a
reversível ganha. Também é coerente com `activated_at` ao lado, que é carimbo
de criação e nunca é atualizado.
**Quarta porta do módulo, com o limiar declarado.**
`ProductActivationGateway` mora em `src/modules/representatives/` porque
`DOMAIN_MODEL.md` §7.3 (linhas 222-223) atribui Product Activation a
Representative Management — Catalog Management (§7.4) é dona de Catalog e
Product, não de Activation — e nenhum módulo `catalog` existe. A convenção do
módulo se mantém: "Repository" lê, "Gateway" escreve. Isso leva o módulo a
**quatro portas**, o que é aceitável agora (cada uma tem chamador e postura de
autenticação distintos), mas o limiar fica registrado: **se aparecer um módulo
`catalog` de verdade ou a superfície de administração do Stage 5, esta porta é
a primeira coisa a sair de `representatives/`.** A porta é deliberadamente só
de escrita — ler "minhas ativações" (que o D5 vai precisar) pertence a uma
porta de leitura, e `product_activations_select_own` já desbloqueia esse
acesso.
**Nota de implementação que não deve ser "limpa".** As duas funções são
`returns table (status text, ...)` e `status` também é nome de coluna em
`representatives` e em `product_activations`; o parâmetro OUT sombreia o nome,
e uma referência não qualificada levantaria "column reference is ambiguous"
**em tempo de execução**, não na criação. Por isso toda coluna aparece
qualificada por alias e todo retorno passa por `return query select`.
**Teste.** `tests/map-product-activation-result.test.ts` cobre os dois
mapeadores: sucesso, cada motivo de rejeição, `status` desconhecido → `error`,
`data` nulo/vazio → `error`, `error` não-nulo → `error`, e sucesso com id
ausente → `error` (nunca fabrica id). Também afirma que cada mapeador rejeita
o status de sucesso **do outro** — as duas strings mais plausíveis de vazarem
entre eles por copy-paste. As funções SQL em si não têm teste automatizado,
mesma lacuna aceita do ADR-040: verificação manual em `supabase/README.md`,
passo 11.
**Custo de reversão.** Baixo — `drop function` nas duas; nenhuma policy,
tabela ou coluna foi tocada, e nenhuma linha existente é migrada.
