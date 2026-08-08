### ADR-072 — Lifecycle de `subscriptions` e graça pós-cancelamento sem job (SET-26)

**Status:** Accepted
**Date:** 2026-08-08
**Related:** Implementa as decisões de `docs/plans/BILLING_DECISIONS_PLAN.md`
§5 (SET-25, falha de cobrança e cancelamento) e §6.2 (SET-6, preço gravado
por linha); reaproveita `is_subscription_active()` do ADR-063 e o padrão de
UPSERT de reativação do `SPRINT_E_PLAN.md` §3.1 Opção B.

#### Contexto e problema

`subscriptions` (ADR-033) sustentava só a ativação manual: `status`,
`provider`, `external_subscription_id`, `current_period_end` — este último
nunca lido por nenhuma função. SET-16 (billing automático) precisa que o
schema já comporte o ciclo de vida aprovado em SET-25 antes que exista
qualquer webhook real para produzi-lo: preço por linha (SET-22/§6.2), meio
de pagamento explícito (SET-24/§6.1), e a política "cancelamento é efetivo
no fim do ciclo já pago, não imediato" sem exigir infraestrutura de job —
que este projeto conscientemente não tem (`SPRINT_E_PLAN.md` §2.4).

#### Alternativas consideradas

1. **Adicionar um novo valor de `status` (`'canceled_pending'` ou
   equivalente) para representar "cancelado, ainda em graça".** Rejeitada:
   a CHECK de `status` já aceita `'canceled'` desde a migration original
   (`20260731000000`) — nunca usado de fato, mas sempre legal. Inventar um
   quinto valor duplicaria semântica que `current_period_end` já cobre.
2. **Um job periódico (`pg_cron` ou externo) que varre `subscriptions` e
   flipa `canceled` → sem acesso quando `current_period_end` passa.**
   Rejeitada: introduziria a primeira infraestrutura de job do projeto para
   resolver algo que uma leitura ao vivo resolve sem nenhum estado extra —
   exatamente o tipo de complexidade que `SPRINT_E_PLAN.md` §2.4 já registrou
   como consciente e evitável.
3. **Avaliar `current_period_end` ao vivo dentro de `is_subscription_active()`.**
   Escolhida: `status = 'active' OR (status = 'canceled' AND
   current_period_end > now())`. Nenhum processo periódico — a leitura é
   sempre correta no instante em que acontece, e é a mesma função —
   `security definer stable` — que a policy pública já chama por linha.
4. **Permitir ou proibir reativação de `canceled` para `active`.**
   `DOMAIN_MODEL.md` §14.3 (antes deste ADR) marcava Canceled como terminal,
   exigindo "uma nova Subscription". Mas `subscriptions.representative_id`
   é `unique` — não existe "criar uma nova", existe uma linha reaproveitada
   por UPSERT, mesmo mecanismo que já reativa de `suspended` para `active`
   hoje. Proibir reativação exigiria inventar uma segunda linha ou uma
   coluna de "geração" sem nenhum requisito de produto pedindo isso.
   Escolhida: permitir `canceled` → `active` pela mesma UPSERT, e corrigir
   `DOMAIN_MODEL.md` §14.3 para refletir isso.
5. **Alterar a CHECK de `status` para ampliar `payment_method`/`currency`
   no futuro.** Não aplicável agora — ambos ganham CHECK de um valor único
   (`'credit_card'`, `'BRL'`) de propósito, ampliável por
   `drop`/`add constraint` numa migration futura, nunca editando esta
   (`BILLING_DECISIONS_PLAN.md` §6.1/§6.2).

#### Decisão

Migration `20260823000000_add_billing_lifecycle_columns.sql`, aditiva:

- `subscriptions` ganha `payment_method` (`not null default 'credit_card'`,
  CHECK de um valor), `amount_cents` (nullable — linhas manuais existentes
  não têm valor retroativo), `currency` (`not null default 'BRL'`, CHECK de
  um valor), `external_customer_id` (acompanha `external_subscription_id`,
  que já existia).
- `is_subscription_active(uuid)` redefinida (`create or replace`, mesmos
  grants) para a regra de graça do item 3 acima.
- Nenhuma alteração na CHECK de `status`.
- `DOMAIN_MODEL.md` §14.3 atualizado: o diagrama de estados passa a refletir
  graça até `current_period_end` e reativação `canceled` → `active`
  permitida, substituindo a versão `[Inferred]` anterior que assumia
  cancelamento imediato e terminal.

Testado manualmente contra o banco de desenvolvimento conectado (fixture
real, não simulada): `active` → ativo; `canceled` com `current_period_end`
no futuro → ativo (graça); `canceled` com `current_period_end` no passado →
inativo; `suspended` → inativo independente do período. Sem cleanup
remanescente.

#### Consequências

- Nenhum job/cron entra no projeto — a graça pós-cancelamento é uma
  propriedade da função de leitura, não um processo em background.
- `payment_method`/`amount_cents`/`currency` ficam prontos para SET-28
  gravar por linha antes de qualquer webhook existir, sem uma segunda
  migration de schema quando SET-28/29/30 chegarem.
- Reativação após cancelamento é gratuita (mesma UPSERT), mas ainda não tem
  UI nem gatilho automatizado — isso é escopo de SET-32 (cancelamento) e
  SET-30 (sync de entitlement), não deste passo.
- Risco aceito: `payment_method`/`currency` com CHECK de um valor único
  significam que qualquer ampliação futura (Pix Automático, outra moeda) é
  uma migration nova alterando a constraint — decisão deliberada, não uma
  limitação descoberta depois.

#### Rollback conceitual

Reversão é aditiva-inversa: `drop column` das quatro colunas novas e
`create or replace function is_subscription_active` de volta à versão do
ADR-063 (só `status = 'active'`) restauram o comportamento anterior sem
perda de dado de negócio, já que nenhuma linha existente dependia dos
campos novos (todas nasceram `NULL`/default). A atualização de
`DOMAIN_MODEL.md` §14.3 reverteria junto, como parte do mesmo commit de
rollback.
