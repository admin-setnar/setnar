# SPRINT_E_PLAN.md

> Plano de investigação — Subscription/Billing (D7): o gate que falta pro Stage 1
> medir a própria hipótese
> Status: **proposta, não implementada** — nenhum código deste documento existe
> Escopo: `docs/ROADMAP.md` Stage 1 (item de cobrança, nunca antes fechado);
> `docs/DOMAIN_MODEL.md` Regra 21 (§14.1/§8.14); o item **D7** que
> `docs/SPRINT_D_PLAN.md` deixou registrado como "fora do elo, listado pra não
> sumir"; e o desvio consciente que `ADR-043` já documentou (README.md) sem
> resolver

Mesmo contrato dos planos anteriores (`SPRINT_D_PLAN.md`, `QR_ANALYTICS_PLAN.md`):
este documento **investiga e levanta decisões, não fecha nenhuma sozinho**. Onde
há custo de produto ou custo de reversão alto, as opções vêm lado a lado, com
prós/contras, e a escolha é do Pedro. Os passos de implementação são pequenos,
revisáveis e testáveis isoladamente. ADRs entram no `README.md` só quando cada
passo for de fato implementado — o próximo número livre é **ADR-063**; o
próximo passo livre da lista numerada do `supabase/README.md` é o **17**.

---

# 1. Onde isso se encaixa no que já existe

`PRODUCT.md` define o MVP Goal como uma frase só: *"Validate whether
independent representatives are willing to pay for a Digital Office. Nothing
else."* Hoje, nada no produto testa isso — qualquer representante que termina
o onboarding (D3.B) publica de graça. Isso não é um bug: é um desvio
**conscientemente registrado e não resolvido**. O cabeçalho de
`20260807000000_add_product_activation_write_path.sql` diz, textualmente, que
Subscription ativa "é D7, fora deste elo"; `representative-repository.ts:8-21`
avisa que "callers must not treat a non-null result as safe to render publicly
until that check is added"; e `ADR-033` (README.md) já criou a tabela
`subscriptions` exatamente para este momento, gerenciada manualmente
(`provider = 'manual'`) até existir um gateway de cobrança real.

Ou seja: **isto não é modelagem nova.** `DOMAIN_MODEL.md` §8.14 e a Regra 21
(*"a Commercial Page cannot remain Published if its owner's Subscription is
not Active"*) já descrevem o comportamento; §15.4 já desenha o fluxo de
suspensão. Este plano fecha a lacuna entre o que já está escrito e o que já
está no banco.

A ideia validada com o Pedro — representante sem pagamento vê um preview
privado, mas não publica — não exige um conceito novo. O estado `draft`
de `product_activations` já existe, já é privado por RLS (`representatives_select_own`/
`product_activations_select_own`, D2, `20260804000000` + correção em
`20260805000000`), e já é onde todo representante começa (`activate_product`
sempre cria em `draft`). O único trabalho real é impedir a transição
`draft/unpublished → published` sem Subscription ativa — e impedir que uma
página **já** publicada continue resolvendo publicamente depois que a
assinatura cai.

---

# 2. Investigação — dois pontos de enforcement, não um

## 2.1 Ponto de escrita (já existe, falta a 4ª precondição)

`set_activation_status` (`20260807000000`) já tem um gate de publicação com
três precondições em ordem: `representatives.status = 'active'` →
`display_name` preenchido → `phone` preenchido. O cabeçalho da própria
migration já reserva o lugar da quarta, só não a implementa. Isto é o alvo
óbvio, mas sozinho não basta — ver 2.2.

## 2.2 Ponto de leitura (não existe, e é o que realmente publica)

Neste schema, **não existe tabela `commercial_pages`** — uma Commercial Page
É uma linha de `product_activations` com `status = 'published'`
(`20260807000000`, comentário "O que é uma Commercial Page NESTE schema").
Quem decide o que fica público são as policies `representatives_select_public`
e `product_activations_select_published` (`20260731000000:244-267`) e o
adapter que as consulta, `SupabaseRepresentativeRepository.findPublishedActivation`
(`src/modules/representatives/infrastructure/supabase-representative-repository.ts`).
Nenhum dos dois olha para `subscriptions` hoje.

Consequência: mesmo que o passo 2.1 feche o gate de **escrita**, uma
Subscription que **cai depois de já publicado** não tira a página do ar — a
Regra 21 diz "must **remain** Published", não só "não pode **ser** publicado",
e isso é um enforcement de **leitura**, não de escrita. Os dois pontos
precisam ser fechados juntos, ou o segundo fica descoberto exatamente como o
primeiro estava.

## 2.3 A pegadinha do default da coluna

`subscriptions.status` tem `default 'active'` (`20260731000000:277`). Como
nada nunca insere uma linha (D3.B não cria; nenhum outro caminho existe), isso
hoje é inofensivo — mas qualquer UPSERT manual futuro que esqueça de setar
`status` explicitamente nasce "ativo" sem ninguém ter decidido isso. Vale
registrar como armadilha a evitar no passo E3, não como algo a corrigir agora
(mudar o default é reversível e barato se um dia incomodar).

## 2.4 Não existe infraestrutura de job/webhook neste projeto

Busquei por `cron`, `webhook`, `scheduled`, `stripe`, `pagar.me`, `iugu` — nada.
`ROADMAP.md` só lista "Scheduled actions" no Stage 4 (Automate), ainda não
validado. Isso pesa diretamente na decisão do §3.2: qualquer solução que
dependa de um processo rodando periodicamente para "notar" que uma assinatura
venceu introduz infraestrutura que este projeto conscientemente ainda não tem.

---

# 3. Decisões a fechar — a escolha é do Pedro

## 3.1 Como a Subscription nasce (ou não nasce) para um representante novo

**Opção A — provisionar uma linha no onboarding.** `register_representative`
(D3.B) passaria a inserir uma linha em `subscriptions` com um status próprio
para "nunca pagou" (`pending`/`trialing`). Exige alterar o `CHECK` da coluna
(migration nova, `drop constraint` + `add constraint` — não é editar a
migration antiga, é permitido) para aceitar um quinto valor, e mexer numa
função que hoje é enxuta e já revisada (ADR-040/ADR-061/ADR-062).

**Opção B — nenhuma linha nasce (recomendo).** Ausência de linha em
`subscriptions` para um `representative_id` significa, por definição de
`is_subscription_active()` (E1), "nunca ativo". Zero migration de schema, zero
mudança em `register_representative`. Quando o pagamento é confirmado
manualmente, um único UPSERT (`insert ... on conflict (representative_id) do
update set status = 'active', ...`) cobre tanto "primeira ativação" quanto
"reativação após suspensão" — um caminho só, sem um estado `pending` extra
para manter sincronizado com nada.

**Trade-off, dito sem meio-termo confortável:** na Opção B, "nunca assinou" e
"assinou e foi suspenso" são indistinguíveis olhando só pra ausência de linha
— mas `is_subscription_active()` trata os dois exatamente igual (`false`), que
é o único comportamento que qualquer um dos dois pontos de enforcement precisa
hoje. Se um dia a UI precisar de textos diferentes ("você nunca ativou" vs.
"sua assinatura está suspensa"), isso é uma leitura adicional a escrever
depois, não uma migração de dado.

## 3.2 Onde o enforcement de leitura acontece

**Opção A — na policy (recomendo).** `is_subscription_active(representative_id
uuid)`, `security definer`, `stable`, roda como dono e não expande RLS de
nenhuma tabela — mesmo mecanismo de `is_own_representative()`, que já prova
que uma função `SECURITY DEFINER` dentro de uma policy não reabre o ciclo
42P17 que `ADR-039`/`20260805000000` já corrigiu (ela lê `subscriptions`
diretamente, sem consultar a policy de outra tabela). `product_activations_select_published`
é redefinida (`drop policy` + `create policy`, mesmo padrão de
`20260805000000_fix_rls_policy_cycle.sql`) somando
`and public.is_subscription_active(product_activations.representative_id)`.

**Opção B — na aplicação.** `findPublishedActivation` chamaria
`is_subscription_active` como uma segunda leitura depois da query atual,
retornando `null` se falsa, sem tocar a policy.

**Por que A.** A filosofia que já rege este projeto é: a policy É a fonte da
verdade sobre o que é público; a aplicação faz defesa em profundidade por
cima, nunca reimplementa a regra (o comentário do próprio adapter já é
explícito sobre isso — os `.eq()` ali "NÃO são a filtragem, são defesa
adicional"). B duplicaria a decisão de visibilidade em dois lugares — um que
vale pra PostgREST direto (futuro, se algum dia existir um consumidor além do
Next.js) e outro só pro Next.js — e um dos dois ficaria desatualizado primeiro,
sem ninguém notar até um vazamento.

**Nota sobre `status` continuar `'published'`.** Com a Opção A, uma assinatura
vencida NÃO reescreve `product_activations.status` — só some da visibilidade
pública. Consciente e coerente com a decisão já tomada para `published_at`
(ADR-043): destruir "isto já foi publicado" é irreversível, e nada exige isso
para a página deixar de resolver. Se algum dia existir um job real (Stage 4),
ele pode flipar `status` para `unpublished` por cima disso sem conflito — os
dois mecanismos não competem.

## 3.3 Preview: CTA e formulário de lead funcionais, ou desabilitados

Já levantado na conversa anterior — formalizando aqui. **Recomendo
desabilitado.** A árvore visual de `[productSlug]/page.tsx` é reaproveitada
(nunca duplicada) na rota de preview dentro de `/app` (E5), mas `WhatsappCta`
e `LeadForm` recebem uma prop (`interactive={false}`) que troca o botão real
por um estado visualmente idêntico e travado — sem `<a href>` real, sem montar
o form de fato. Sem isso, um representante não-pagante já estaria captando
lead real e mandando mensagem real de WhatsApp numa página que, por definição,
ainda não deveria existir para um cliente — fura a lógica comercial da ideia e
levanta uma questão de LGPD sobre coletar dado de terceiro numa superfície que
o produto trata como inexistente.

---

# 4. Plano de implementação, em passos pequenos

Mesmo processo do lead capture e da Sprint D: **auditar → Pedro revisa →
implementar → `npm run verify` → ADR no `README.md` + entrada no
`supabase/README.md`.**

## E1 — `is_subscription_active(uuid)` + policy de leitura (fecha §2.2, Opção A do §3.2)

Migration nova: função `security definer`, `stable`, `set search_path =
public`, `exists (select 1 from subscriptions where representative_id = $1
and status = 'active')`. `grant execute to authenticated, anon` — precisa
valer para visitante anônimo, é usada dentro de uma policy de leitura pública
(mesmo padrão de `is_bot_user_agent`/`is_login_blocked`, chamadas fora de
sessão). Redefine `product_activations_select_published` somando o predicado.

**Teste manual:** representante com assinatura ativa resolve a página pública;
sem nenhuma linha em `subscriptions`, não resolve (404 genérico, mesmo
anti-enumeration de sempre); com linha `status = 'suspended'`, não resolve.

**Não depende de nada. Revisável e implementável sozinho.**

## E2 — 4ª precondição no gate de escrita (fecha §2.1)

Migration nova redefinindo `set_activation_status` (`create or replace
function`, mesmo corpo + um `if`). Ordem proposta: `representative_status` →
**`subscription_not_active`** → `display_name_required` → `phone_required`.
Subscription entra logo depois do status do representante porque é a mesma
categoria de bloqueio administrativo (a mesma razão que hoje já ordena
"suspenso" antes de "telefone vazio" — não faz sentido mandar alguém sem
assinatura corrigir o perfil primeiro). `activate_product` (cria em `draft`)
**não muda** — draft continua sem gate, é exatamente o preview.

**Depende de E1** (para o novo motivo de falha ser consistente com a mesma
função de checagem; tecnicamente poderia ir em paralelo, mas revisar junto
evita duas fontes de verdade sobre "o que é assinatura ativa").

## E3 — Ativação/reativação manual da Subscription (fecha §3.1, Opção B)

Nenhuma função nova: um UPSERT direto no SQL Editor (conecta como dono,
ignora RLS — mesmo caminho do seed do catálogo, D1), documentado como
**passo 17** do `supabase/README.md`, no mesmo formato "cole isto, nesta
ordem" que o arquivo já usa. Zero código de aplicação.

## E4 — UI: estado bloqueado no `/app`

`ProductActivationCard` passa a receber se a subscription está ativa (nova
prop, mesmo formato que `state` já chega hoje via
`RepresentativeCatalogRepository`). Quando `state` é `draft`/`unpublished` e a
subscription não está ativa, o botão "Publicar" vira um CTA desabilitado
("Ative sua assinatura para publicar" + canal de contato — a definir, mas
apontando para o Pedro/SETNAR, nunca para o próprio representante se
confundir com o WhatsApp comercial dele). Copy de erro nova
(`subscription_not_active`) em `activation-error-messages.ts`, para o caso de
o clique acontecer mesmo assim (sessão antiga, corrida) — defesa em
profundidade, servidor continua sendo a fonte da verdade.

**Achado da verificação manual do passo 17 (`supabase/README.md`), registrado
aqui e não implementado ainda:** com `subscriptions.status = 'suspended'`, a
página pública corretamente para de resolver (E1 funcionando como projetado),
mas `ProductActivationCard`
(`src/modules/representatives/presentation/product-activation-card.tsx:23`)
continua mostrando o badge `Publicado` (`variant: 'success'`, verde) — porque
`product_activations.status` continua `'published'` por design (E1 não
reescreve `status`, só restringe visibilidade pública; ver §3.2 acima). O
representante não recebe nenhum sinal, no próprio hub, de que a página parou
de resolver para o público. Isto é escopo adicional que **E4** precisa
cobrir, além do que já estava descrito acima (bloquear o botão "Publicar"
para `draft`/`unpublished` sem subscription ativa): falta um terceiro estado
visual, distinto tanto do badge verde "tudo certo" quanto do CTA bloqueado de
pré-publicação — algo como "publicado, mas assinatura inativa" — para o caso
`state = 'published'` **e** subscription não ativa. Requer que
`ProductActivationCard` receba o mesmo dado de subscription já previsto acima
para os outros dois estados; não é uma segunda fonte de dado, é o mesmo sinal
aplicado a um terceiro cruzamento de estados que a descrição original de E4
não cobria. Não implementado nesta revisão — só mapeado.

**Depende de E2.**

## E5 — Preview dentro do `/app` (a peça que fecha a ideia do Pedro)

Nova rota privada (ex.: `/app/preview/[productSlug]`), autenticada pelo que já
protege `/app` hoje. Extrai o miolo visual de `[productSlug]/page.tsx` para um
componente compartilhado que as duas rotas consomem — nunca duplicado.
`WhatsappCta`/`LeadForm` recebem `interactive={false}` (§3.3). **Sem
analytics:** `record_page_visit`/`record_whatsapp_click` não disparam aqui —
não é uma visita real, e contar como se fosse inflaria as métricas do próprio
representante sobre a própria página.

**Depende de D2** (já implementado — a leitura das próprias ativações em
`draft` é o que torna esta rota possível).

## E6 — Fechar a referência no ADR existente

`ADR-043` já registrou dois desvios conscientes (`avatar_url` e Subscription).
Quando E2 fechar, o ADR novo (a partir de **ADR-063**) referencia e resolve a
parte de Subscription desse desvio — sem reescrever o ADR-043, só apontando
para frente, mesmo padrão que `ADR-052`/`ADR-054` já usaram com `ADR-051`/`ADR-053`.

---

# 5. Ordem, e o que revisar em cada etapa

| Passo | Depende de | Toca app? | Revisável sozinho |
|---|---|---|---|
| E1 — `is_subscription_active` + policy | — | não | ✅ |
| E2 — gate de publicação (4ª precondição) | E1 | não | ✅ |
| E3 — ativação manual (doc, sem código) | E1 | não (só doc) | ✅ |
| E4 — UI bloqueada no hub | E2 | sim | ✅ |
| E5 — preview no `/app` | D2 (já feito) | sim | ✅ |
| E6 — ADR de fechamento | E1–E5 implementados | não | — |

**E1 pode começar assim que este plano for aprovado.** E5 não depende
tecnicamente de E1–E4 (poderia existir antes do gate fechar), mas construir o
preview antes de a publicação estar de fato bloqueada não tem valor — a ordem
acima é a sequência com feedback mais rápido sobre a hipótese do MVP.

---

# 6. Três decisões, confirmadas pelo Pedro em 2026-08-04

1. **§3.1** — nenhuma linha de Subscription nasce no onboarding (Opção B). **Confirmado.**
2. **§3.2** — enforcement de leitura na policy, via `is_subscription_active()` (Opção A). **Confirmado.**
3. **§3.3** — CTA e formulário de lead desabilitados no preview. **Confirmado.**

E1 implementado em `supabase/migrations/20260815000000_add_subscription_enforcement.sql`
(ADR-063, README.md). E2–E6 seguem a ordem da tabela acima, ainda não
implementados.
