### ADR-075 — Webhook do Asaas: token estático, idempotência por evento, SET-29+30 na mesma função (SET-29, SET-30)

**Status:** Accepted
**Date:** 2026-08-09
**Related:** Fecha o risco aceito registrado no ADR-074 ("uma assinatura paga
no Asaas fica presa em `suspended` no lado local indefinidamente... SET-29/30
é o próximo passo obrigatório"); consome `Representative.id`/`externalReference`
gravados por `reserve_billing_checkout_slot()` (20260824000000/20260825000000);
lê `is_subscription_active()` do ADR-072 sem alterá-la.

#### Contexto e problema

O checkout automatizado (SET-28) reserva uma vaga e redireciona para a página
hospedada do Asaas, mas nada nunca confirma o pagamento de volta —
`subscriptions` fica `suspended` para sempre, mesmo que o cliente pague de
verdade. SET-29 (webhook autenticado/idempotente) e SET-30 (materializar
Subscription/entitlement a partir do evento) são Issues separadas no Linear,
mas este projeto deliberadamente não tem infraestrutura de job/fila
(`docs/plans/SPRINT_E_PLAN.md` §2.4) — não existe outro lugar para
"processar" um evento persistido além da própria requisição HTTP do webhook,
síncrono. As duas colam na mesma função por construção; decidido com o Pedro
implementá-las juntas nesta rodada, em vez de entregar um webhook que recebe
e persiste mas nunca ativa nada.

Webhooks do Asaas são **por cobrança** (`PAYMENT_*`), não por assinatura — a
assinatura recorrente nasce quando o `Checkout` (criado com
`chargeTypes: ['RECURRENT']`, ADR-073) é pago (`CHECKOUT_PAID`). Entrega é
**at-least-once**; o mesmo evento pode chegar mais de uma vez.

#### Alternativas consideradas

1. **Assinatura HMAC do payload, como Stripe.** Rejeitada: não é como o
   Asaas autentica webhooks. Desde 20/fev/2026 o Asaas exige um **token
   estático**, enviado de volta em todo evento no header
   `asaas-access-token` — comparação direta, não verificação criptográfica
   de assinatura (confirmado contra `docs.asaas.com/docs/webhooks-3` e o
   changelog "Obrigatoriedade e auto-geração de tokens para Webhooks").
   Implementar HMAC seria construir para um protocolo que o gateway não
   fala. Escolhida: `crypto.timingSafeEqual` comparando o header ao valor
   configurado em `ASAAS_WEBHOOK_TOKEN`, com checagem de tamanho antes (o
   único vazamento por timing aceito é "o tamanho bate ou não", nunca o
   conteúdo).
2. **Idempotência via tabela de "eventos pendentes" processada por um worker
   separado.** Rejeitada: reintroduziria a infraestrutura de job que este
   projeto conscientemente não tem. Escolhida: `billing_events` com
   `asaas_event_id text not null unique` — o próprio `insert` é o mecanismo
   de dedup (captura `unique_violation`), exatamente o padrão que a doc do
   Asaas recomenda (`docs.asaas.com/docs/how-to-implement-idempotence-in-webhooks`).
3. **Rastrear timestamp de evento por linha para lidar com entrega fora de
   ordem.** Rejeitada: exigiria uma coluna nova só para isso.
   `current_period_end = greatest(atual, novo)` já impede regressão nesse
   campo sem guardar quando cada evento foi gerado; `PAYMENT_OVERDUE` só
   suspende a partir de `status = 'active'` (a `WHERE` da própria
   transição), então um evento de vencimento atrasado chegando depois de
   uma reativação simplesmente não casa nenhuma linha e é registrado como
   `ignored`, não aplicado por engano.
4. **Estender `SubscriptionGateway` (o port que `startCheckoutAction` já
   usa) com o método do webhook.** Rejeitada: são fronteiras de confiança
   diferentes — uma Server Action com sessão de usuário real, a outra uma
   requisição externa autenticada só por token estático, sem sessão
   nenhuma. Escolhido um port novo, `BillingWebhookGateway`, para não
   misturar as duas.
5. **Casamento evento → linha só por `external_subscription_id`.**
   Insuficiente: essa coluna só existe DEPOIS do primeiro pagamento — o
   evento que a preenche pela primeira vez (`CHECKOUT_PAID`) precisa de
   outro jeito de achar a linha. Escolhido: fallback por
   `subscriptions.id = externalReference::uuid`, já que `externalReference`
   é o próprio `id` local enviado na criação do checkout (ADR-073/074) —
   sem inventar um segundo identificador.

#### Decisão

Migration `20260827000000_add_billing_webhook_events.sql`:

- `billing_events` (RLS habilitado, zero policies, mesmo padrão de
  `analytics_events`) — log append-only com `asaas_event_id unique`,
  `payload jsonb` (evento cru inteiro, para auditoria/reconciliação futura
  mesmo que a extração de algum campo abaixo não bata 100% com o formato
  real — nunca confirmado contra tráfego de produção).
- `apply_billing_event()` (`security definer`, `grant` só a `service_role`):
  deduplica por `insert`; tipos de evento fora do lifecycle do MVP
  (`CHECKOUT_CREATED`, `PAYMENT_DELETED`, chargeback, etc.) viram `ignored`
  sem tentar casar linha nenhuma; eventos relevantes
  (`CHECKOUT_PAID`/`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`/`PAYMENT_OVERDUE`)
  casam a linha e aplicam a transição descrita acima.

`src/modules/billing/domain/billing-webhook-gateway.ts` (port) +
`infrastructure/{billing-webhook-write-client,supabase-billing-webhook-gateway,
map-apply-billing-event-result,billing-webhook-gateway-factory}.ts` — mesmo
padrão de `leads`/`analytics` (cliente service-role próprio do módulo, sem
factory compartilhada — nenhuma existe hoje neste código).

`src/app/api/billing/asaas-webhook/route.ts`: `401` sem token/token errado,
`400` payload fora do formato mínimo (`id`/`event` string,
`asaas-webhook.schema.ts` com `.passthrough()`), `200` para qualquer
resultado processado (aplicado, duplicado, ignorado, sem casamento — nenhum
deles é motivo de retry), `500` só em exceção inesperada (deixa o Asaas
tentar de novo).

#### Verificação

Testado diretamente contra o banco de teste conectado (sem sandbox Asaas
configurado neste ambiente — mesma limitação já registrada no ADR-074):
`CHECKOUT_PAID` ativando por `externalReference`; evento duplicado
idempotente; evento subsequente casando só por `external_subscription_id`;
evento atrasado com data anterior não regredindo `current_period_end`;
`PAYMENT_OVERDUE` suspendendo só a partir de `active`, e um repeat com a
linha já suspensa devolvendo `ignored` em vez de reaplicar; tipo de evento
fora de escopo devolvendo `ignored` sem tentar casar; `externalReference`
malformado (`not-a-valid-uuid`) devolvendo `unmatched` sem lançar exceção;
RPC inacessível para `anon`/`authenticated`. Os mesmos nove cenários viraram
`tests/apply-billing-event.integration.test.ts`. `npm run verify` completo
(typecheck, lint, 465 testes incluindo integração contra o banco conectado,
build) limpo.

Fluxo ponta a ponta com tráfego real do Asaas (checkout pago de verdade →
webhook real → ativação) **não foi verificado** — não existe conta Asaas
configurada neste projeto ainda. Ver `supabase/README.md` §8 para os passos
de cadastro do Webhook e o aviso de observar `billing_events.outcome` de
perto na primeira ativação real.

**Atualização pós primeira ativação real (mesmo dia):** o fluxo completo foi
testado contra o Sandbox — checkout pago de verdade, webhook `CHECKOUT_PAID`
entregue, `subscriptions` ativada corretamente. Mas o payload real revelou que
o risco aceito abaixo ("`checkout.subscription.id` não confirmado") era
otimista: o campo simplesmente **não existe** em `CHECKOUT_PAID` — não é uma
divergência de formato, é a ausência do dado. `external_subscription_id`
ficaria `null` para sempre, quebrando o casamento das cobranças de renovação
seguintes. Corrigido tratando `SUBSCRIPTION_CREATED` (migration
`20260828000000_handle_subscription_created_event.sql`), que carrega
`subscription.id` + `subscription.externalReference` e grava a coluna uma
única vez (`coalesce`), sem tocar `status`/`current_period_end`. Exige
assinar esse evento no painel do Asaas (`supabase/README.md` §8) — passo
manual ainda não confirmado como feito no ambiente de produção real (só no
Sandbox de teste usado para validar este código).

#### Consequências

- Um checkout pago agora ativa a Subscription sem intervenção manual — fecha
  o risco aceito no ADR-074.
- `billing_events` também serve como base para SET-33 (reconciliação
  administrativa) sem trabalho adicional — o payload cru de todo evento já
  fica gravado desde o primeiro dia.
- Risco aceito: alguns campos do payload do Asaas (`checkout.subscription.id`
  especificamente) foram extraídos com base na documentação pública, não
  confirmados contra um evento real — se o formato divergir, o pior caso é
  `unmatched` (registrado, sem escrita indevida), nunca uma ativação
  incorreta.
- SET-32 (cancelamento) ainda não existe — uma assinatura cancelada pelo
  representante hoje seria escrita diretamente em `subscriptions` por essa
  Issue futura, não por este webhook (o Asaas não emite um evento de
  "assinatura cancelada pelo cliente" nesse fluxo; cancelamento é sempre
  iniciado pelo SETNAR chamando `cancelSubscription()`).

#### Rollback conceitual

Reversão de aplicação: remover a rota
(`src/app/api/billing/asaas-webhook/route.ts`), o módulo de domínio/infra
novo (`billing-webhook-gateway.ts` e os quatro arquivos de infraestrutura),
os schemas/helpers de apresentação, e a função desta migration
(`drop function apply_billing_event()`, `drop table billing_events`).
Nenhuma linha de `subscriptions` precisa reverter — uma linha `active` já
ativada por um evento real continua correta mesmo sem o código que a
processou; o comportamento volta a ser o do ADR-074 (assinatura paga fica
presa em `suspended`).
