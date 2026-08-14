# Runbook — Operação e Incidentes de Billing

**SET-35.** Documentação operacional, não normativa — não decide arquitetura
nem produto (isso é `docs/ARCHITECTURE.md`/ADRs); descreve **o que fazer**
quando algo dá errado no fluxo de cobrança. Ver
[`docs/README.md`](../README.md) para a hierarquia de autoridade completa;
este arquivo não aparece nela de propósito, pelo mesmo motivo que
`docs/plans/` não aparece — é procedimento, não decisão.

**Para quem é isto:** um único desenvolvedor (este projeto não tem
sistema de roles/admin, `docs/plans/SPRINT_E_PLAN.md` §2.4) precisando
diagnosticar e corrigir um incidente de billing sem improvisar no momento.

**Pré-requisitos** para qualquer procedimento abaixo: acesso ao SQL Editor
do projeto Supabase (ou `SUPABASE_SERVICE_ROLE_KEY` local), e — só para os
procedimentos que chamam o Asaas — `ASAAS_API_KEY`/`ASAAS_BASE_URL`
configuradas (`.env.local`, ou as mesmas em produção via Vercel,
`supabase/README.md` §5).

**Regra que atravessa todo este documento:** nenhum exemplo abaixo contém
segredo real, e-mail, telefone ou qualquer outro dado pessoal de
representante/cliente — todo valor de exemplo é sintético
(`cus_exemplo_123`, `evt-exemplo-...`). Ao copiar um comando deste runbook
para uso real, **nunca** cole um payload cru do Asaas em um lugar que vá
para log persistente ou para este próprio arquivo depois.

---

## 1. Vocabulário rápido — onde cada coisa mora

| Tabela / função | O que audita | Quem grava | RLS |
|---|---|---|---|
| `subscriptions` | Estado atual da assinatura (`status`, `current_period_end`, `external_subscription_id`) | `apply_billing_event()`, `reserve_billing_checkout_slot()`, `confirm_own_subscription_cancellation()` | Habilitado, zero policies — só `service_role` |
| `billing_events` | Todo evento financeiro recebido do Asaas (webhook ou reconciliação), um por `asaas_event_id` | `apply_billing_event()` | Habilitado, zero policies — só `service_role` |
| `billing_reconciliation_log` | Toda **ação de operador** — quem rodou o quê, por quê, contra qual representante, com que resultado | `scripts/reconcile-billing-subscription.ts` (e, por procedimento manual, qualquer intervenção SQL direta — ver §5) | Habilitado, zero policies — só `service_role` |

Estados de `subscriptions.status`: `active`, `past_due` *(reservado no
schema; `apply_billing_event()` hoje nunca escreve este valor)*, `suspended`,
`canceled`. Entitlement (`is_subscription_active()`, ADR-063/072) é
`true` para `active`, e também para `canceled` enquanto
`current_period_end > now()` (graça pós-cancelamento, ADR-076) — **nunca**
infira "tem acesso" só olhando `status`; sempre confira `current_period_end`
também, ou chame a própria função.

Ver ADR-075 (webhook + `apply_billing_event`), ADR-076 (cancelamento),
ADR-077 (reconciliação) para o raciocínio completo de cada peça — este
runbook não repete o "porquê", só o "o que fazer".

---

## 2. Consultas seguras de diagnóstico

Rode estas antes de qualquer escrita, sempre — elas nunca modificam nada.

**Estado de uma assinatura específica** (troque `<representative_id>`):

```sql
select id, status, provider, external_subscription_id, external_customer_id,
       current_period_end, created_at
from subscriptions
where representative_id = '<representative_id>';
```

**Histórico de eventos de uma assinatura** (troque `<subscription_id>`):

```sql
select asaas_event_id, event_type, outcome, created_at
from billing_events
where subscription_id = '<subscription_id>'
order by created_at desc
limit 20;
```

**Assinaturas potencialmente divergentes** — `active` cujo período já
venceu (indício de que um `PAYMENT_OVERDUE` não chegou ou não casou):

```sql
select id, representative_id, status, current_period_end
from subscriptions
where status = 'active' and current_period_end < now();
```

Ensaiada contra o banco de dev conectado em 2026-08-10: **zero linhas**,
estado saudável no momento do ensaio — nenhuma divergência fabricada para
este runbook, o resultado real foi vazio.

**Eventos que não casaram nenhuma assinatura** (o webhook já loga isso com
`console.error`, mas a fonte de verdade é a tabela):

```sql
select asaas_event_id, event_type, created_at
from billing_events
where outcome = 'unmatched'
order by created_at desc
limit 20;
```

**Funil trial → pago (SET-67).** Nenhuma tabela/evento de analytics novo —
`representatives.created_at` já é o instante de início do trial (`register_representative()`
grava a linha de `subscriptions` com `status = 'trialing'` no mesmo passo);
a conversão fica registrada em `subscriptions.updated_at` quando o status
sai de `trialing`. Decisão de escopo registrada no plano do SET-67:
consistente com o resto do módulo (sem fila/job) e com `QR_ANALYTICS_PLAN.md`
(painel de analytics segue não implementado de propósito).

```sql
select
  r.id as representative_id,
  r.created_at as trial_started_at,
  s.status,
  s.updated_at as last_status_change,
  (s.status <> 'trialing') as converted
from representatives r
join subscriptions s on s.representative_id = r.id
order by r.created_at desc;
```

`converted = true` e `status = 'active'` é uma conversão fechada; `status =
'trialing'` com `current_period_end` no passado é um trial expirado sem
conversão; `status in ('suspended', 'canceled')` com `provider = 'asaas'`
é uma conversão iniciada que não se confirmou (pagamento falhou, ou nunca
chegou o webhook).

---

## 3. Incidente: webhook parado

**Sintoma:** o Asaas mostra cobranças confirmadas, mas `subscriptions`
não reflete isso — nenhuma linha nova em `billing_events` para o período.
O Asaas pausa a fila de um Webhook depois de 15 falhas consecutivas de
entrega (`docs.asaas.com/docs/webhook-errors`, citado em
`src/app/api/billing/asaas-webhook/route.ts`).

**Diagnóstico:**

1. No painel do Asaas: **Integrações → Webhooks** → confira se o Webhook
   cadastrado (`supabase/README.md` §8) está ativo/pausado, e o histórico
   de tentativas recentes (status HTTP retornado).
2. Se o Asaas mostra `401` nas tentativas: o `ASAAS_WEBHOOK_TOKEN`
   configurado no painel do Asaas divergiu do valor em produção na Vercel
   — ver §4 (rotação de segredo) para a causa mais provável.
3. Se o Asaas mostra `500`: confira `get_logs`/logs da função na Vercel
   para a exceção real — a rota só devolve `500` em falha inesperada
   (ex.: banco fora do ar), nunca por evento processável.
4. Confirme o intervalo sem eventos:
   ```sql
   select max(created_at) as ultimo_evento from billing_events;
   ```

**Recuperação, depois de corrigir a causa raiz (token, disponibilidade do
banco, etc.):**

O Asaas não reenvia sozinho eventos de antes da pausa ter sido corrigida —
não há um "replay" automático retroativo garantido. Para cada assinatura
afetada, reconcilie manualmente:

```
npm run reconcile:billing -- --representative-id=<uuid> --reason="webhook parado entre <data1> e <data2>, recuperando evento perdido" --actor="<seu nome>"
```

Sempre sem `--apply` primeiro, confira o `outcome` impresso, só então repita
com `--apply` — `supabase/README.md` §9 tem o procedimento completo e a
tabela de outcomes. Reconciliar é idempotente por construção (o
`asaas_event_id` sintético usado é o `id` real do pagamento no Asaas): se o
webhook atrasado chegar depois de tudo corrigido, a `unique constraint` de
sempre o ignora sozinha, sem duplicar nada.

**Sem lista automática de "quem foi afetado":** hoje isso exige comparar
manualmente a lista de cobranças confirmadas no painel do Asaas contra
`billing_events` para o mesmo período. Não existe alerta automatizado nem
prazo de detecção neste projeto — ver §7.

---

## 4. Incidente: evento duplicado

**Sintoma:** preocupação de que um evento processado duas vezes tenha
cobrado ou ativado a assinatura em dobro.

**Isto normalmente não é um incidente — é o comportamento esperado.**
`apply_billing_event()` deduplica por `asaas_event_id` (constraint
`unique`, ADR-075); uma segunda entrega do mesmo evento sempre retorna
`outcome = 'duplicate'` e **não escreve nada**. Confirme:

```sql
select asaas_event_id, count(*) as vezes_recebido
from billing_events
where asaas_event_id = '<asaas_event_id>'
group by asaas_event_id;
```

Deve retornar sempre `1` — a `unique constraint` impede fisicamente uma
segunda linha para o mesmo `asaas_event_id`; se a contagem aparecer maior
que 1, o problema é na própria constraint (migration
`20260827000000_add_billing_webhook_events.sql`), não no webhook, e é um
bug de schema a corrigir por migration nova (nunca alterando a aplicada —
ver §6).

**Ensaiado de verdade em 2026-08-10**, contra o banco de dev conectado,
com um representante/assinatura descartáveis (removidos ao final): duas
chamadas de `apply_billing_event()` seguidas com o **mesmo**
`asaas_event_id` sintético.

- 1ª chamada: `{ outcome: 'applied', subscription_id: '<id>' }` —
  `subscriptions.status` foi de `suspended` para `active`,
  `current_period_end` foi gravado.
- 2ª chamada, idêntica: `{ outcome: 'duplicate', subscription_id: null }` —
  nenhuma escrita adicional.
- `billing_events` continha **exatamente uma linha** para aquele
  `asaas_event_id` depois das duas chamadas.

O que **é** um incidente real: dois eventos com `asaas_event_id`
**diferentes** para a mesma cobrança (ex.: o Asaas gerar um novo id ao
reenviar, em vez de repetir o original — não documentado como
comportamento normal, mas não descartado). Se isso acontecer,
`billing_events` mostra duas linhas com `payload` quase idênticos exceto
o id; o segundo evento é aplicado normalmente (idempotência por id não
ajuda aqui), e a correção é a mesma do §5 — reversão manual, com trilha.

---

## 5. Incidente: entitlement divergente

**Sintoma:** representante reporta acesso perdido mesmo tendo pago, ou
reporta continuar com acesso mesmo tendo cancelado/deixado de pagar; ou
a consulta de diagnóstico do §2 (`active` com período vencido) retorna
linhas.

**Diagnóstico:**

1. Rode as consultas do §2 para a assinatura específica.
2. Confira `billing_events` para essa `subscription_id` — o evento
   esperado (`CHECKOUT_PAID`, `PAYMENT_OVERDUE` etc.) chegou? Casou com a
   linha certa (`subscription_id` preenchido, não `null`)?
3. Se o evento **não chegou**: é o cenário do §3 — reconciliar via script,
   não corrigir a mão.
4. Se o evento **chegou mas não casou** (`outcome = 'unmatched'`): o
   `external_subscription_id`/`externalReference` do payload não bateu com
   nenhuma linha local. Confira se `SUBSCRIPTION_CREATED` já havia gravado
   `external_subscription_id` para essa assinatura (`supabase/README.md`
   §8) — um evento de renovação chegando antes desse backfill não tem como
   casar.
5. Se o evento **chegou e aplicou algo diferente do esperado**
   (`outcome = 'applied'` mas o resultado em `subscriptions` está errado):
   provavelmente um mapeamento de payload do Asaas divergente do
   documentado (risco aceito registrado em ADR-075/077) — é aqui que uma
   correção manual entra.

**Correção manual — só depois de esgotar reconciliação automática (§3), e
sempre com trilha:**

`current_period_end` e `status` são as **únicas** colunas que qualquer
procedimento de billing deste runbook deve tocar manualmente. Nenhum outro
campo de `subscriptions` (`external_subscription_id`,
`external_customer_id`, `provider`, `amount_cents`) deve ser escrito à
mão — se um desses estiver errado, o bug é no código de mapeamento, não no
dado, e a correção é uma migration/patch de código, não uma UPDATE
avulsa.

**Toda correção manual exige ator e motivo, sem exceção** — mesma
exigência que `scripts/reconcile-billing-subscription.ts` já impõe por
código (`--reason`/`--actor` obrigatórios). Uma UPDATE direta no SQL
Editor não tem esse controle embutido, então o procedimento supre isso:
grave a trilha **antes** de escrever, na mesma sessão:

```sql
-- 1. Registrar a intervenção ANTES de corrigir — se a correção falhar,
--    a intenção já ficou registrada.
insert into billing_reconciliation_log
  (actor, reason, representative_id, subscription_id, outcome, detail)
values (
  '<seu nome>',
  '<motivo específico do incidente, ex: evento SUBSCRIPTION_CREATED nunca chegou, current_period_end corrigido manualmente a partir do painel do Asaas>',
  '<representative_id>',
  '<subscription_id>',
  'manual_correction',
  jsonb_build_object('before_status', '<status anterior>', 'before_current_period_end', '<valor anterior>')
);

-- 2. Só então a correção.
update subscriptions
set status = '<novo status>', current_period_end = '<novo valor, ou omitir esta coluna se não muda>'
where id = '<subscription_id>';
```

O valor anterior vai dentro de `detail` **porque foi lido e conferido no
diagnóstico (§2) antes deste passo** — nunca grave um `before_*` que você
não checou de verdade primeiro. Isso é o que torna a correção reversível:
reverter é rodar a mesma UPDATE de volta ao valor gravado em `detail`.

---

## 6. Rollback — forward-only, sem exceção

Este projeto **nunca** edita uma migration já aplicada (`README.md`
principal, seção de migrations) e não tem infraestrutura de
rollback automático de schema. Isso vale integralmente para billing:

- **Uma migration com bug** é corrigida por uma **migration nova**
  (`drop function` + `create function`, ou `alter table`) — nunca editando
  o arquivo já aplicado. Ver `20260825000000_fix_checkout_reservation_and_reclaim_bugs.sql`
  e `20260831000000_fix_checkout_retry_and_cancellation_race.sql` para o
  padrão real já usado neste módulo.
- **Reverter uma feature de billing** (ex.: desativar o webhook por
  completo) é uma reversão **aditiva-inversa**, nunca um `git revert` cego
  de migration: remover a rota/função/módulo em uma migration/commit
  novos. Cada ADR de billing (075/076/077) documenta a sua própria seção
  "Rollback conceitual" com os arquivos exatos a remover — leia a do
  recurso específico antes de reverter.
- **Nenhuma reversão de código precisa reverter dados.** Por desenho: uma
  linha de `subscriptions` já `active`/`canceled` continua correta mesmo
  se o código que a processou for removido depois — os três ADRs de
  billing registram isso explicitamente. Rollback de código e rollback de
  dado são decisões independentes; não assuma que reverter um precisa do
  outro.
- **Reversão de dado** (quando necessária) é sempre a correção manual do
  §5 — uma UPDATE direta, auditada em `billing_reconciliation_log`, nunca
  um segundo script de "desfazer".

---

## 7. Rotação de segredo

| Segredo | Efeito de rotacionar | Procedimento |
|---|---|---|
| `ASAAS_WEBHOOK_TOKEN` | **Corte abrupto, sem janela de graça** — `verify-asaas-webhook-token.ts` compara contra um único valor configurado; não há suporte a dois tokens válidos simultaneamente. Trocar um lado sem o outro derruba a autenticação do webhook até o segundo lado ser atualizado (§3, sintoma "401 nas tentativas"). | 1) Gere um novo valor (≥32 caracteres, sem espaço, sem sequência numérica nem 4 letras repetidas — regra do próprio Asaas, `supabase/README.md` §8). 2) Atualize o Webhook no painel do Asaas **e** a variável `ASAAS_WEBHOOK_TOKEN` na Vercel **na mesma janela de manutenção**, o mais próximo possível um do outro. 3) Confirme no painel do Asaas que a próxima tentativa de entrega (ou um evento de teste) retorna `200`. |
| `ASAAS_API_KEY` | Afeta checkout (criação de customer/checkout), cancelamento (`DELETE /v3/subscriptions/:id`) e reconciliação (`GET /v3/payments`) — os três param de funcionar com a chave antiga imediatamente após a revogação no painel do Asaas. | 1) Gere a nova chave no painel do Asaas (a antiga pode ser revogada separadamente, o Asaas permite mais de uma ativa). 2) Atualize `ASAAS_API_KEY` na Vercel. 3) Revogue a chave antiga só depois de confirmar um checkout de teste ponta a ponta com a nova. |
| `SUPABASE_SERVICE_ROLE_KEY` | Afeta o webhook, a reconciliação e qualquer chamada `service_role` do projeto inteiro (não é exclusiva de billing). | Rotação pelo painel do Supabase (Settings → API) — fora do escopo deste runbook de billing especificamente; ver o procedimento geral do projeto se existir, ou tratar como qualquer rotação de credencial de produção: gerar, atualizar Vercel, confirmar, revogar a antiga. |
| `LOGIN_ATTEMPT_SALT` / `ANALYTICS_IP_SALT` | Fora do escopo de billing — não rotacionar sem motivo (invalida hashes já gravados, `supabase/README.md` §5). Citado aqui só para não confundir com os segredos de billing acima. | — |

**Nenhum destes valores deve aparecer em texto puro** neste runbook, em
`billing_reconciliation_log.detail`, ou em qualquer log de aplicação —
`console.error` neste módulo nunca deve receber o valor de um segredo,
só o resultado da comparação (`verifyAsaasWebhookToken` já segue essa
regra, comparando em tempo constante sem logar nenhum dos dois lados).

---

## 8. Contatos do gateway (Asaas)

**Contato de suporte para problemas de pagamento**: `contato@setnar.com` —
preenchido pelo Product Owner em 2026-08-14. É o canal para onde um
representante ou quem estiver de plantão deve escalar um incidente de
billing; fecha o Achado 4 de `docs/AUDIT_MVP_LAUNCH.md`.

Ainda não registrado neste repositório (não bloqueia o lançamento, já que
o canal primário acima existe — preencher quando houver essa informação):

- Canal de suporte Asaas (painel → Ajuda/Suporte) e SLA de resposta deles,
  se houver.
- Se existir um gerente de conta ou contato comercial dedicado.

Para questões do lado do Asaas (não do SETNAR), o canal disponível é o
suporte padrão do painel do Asaas (`https://www.asaas.com`, autenticado
com a conta do projeto) e a página pública de status/changelog já citada
em `supabase/README.md` §8 para mudanças de comportamento do webhook.

---

## 9. Comunicação ao cliente (representante)

**Fora de escopo:** um manual de atendimento completo ou qualquer SLA de
resposta — não aprovado (mesma exclusão do próprio SET-35). O que segue
são dois rascunhos mínimos, para não improvisar o tom no meio de um
incidente real; ajuste antes de enviar.

**Acesso caiu por atraso no processamento de pagamento (webhook parado,
§3, já confirmado que o pagamento foi recebido no Asaas):**

> Olá, [nome]. Identificamos uma falha temporária na confirmação
> automática do seu pagamento — sua página já está sendo restaurada e
> deve voltar ao ar em poucos minutos. Nenhuma cobrança adicional foi
> feita. Qualquer dúvida, é só responder este e-mail.

**Cobrança confirmada, mas ainda aparecendo como pendente para o cliente
(reconciliação em andamento):**

> Olá, [nome]. Confirmamos o recebimento do seu pagamento e estamos
> ativando sua assinatura manualmente — deve refletir no seu painel em
> poucos minutos. Se não atualizar até [horário], responda este e-mail
> que verificamos na hora.

Nenhum dos dois modelos promete prazo automático nem cita valores/detalhes
de pagamento — evite copiar qualquer campo de `billing_events.payload`
para uma mensagem ao cliente (pode conter dado do Asaas não destinado a
sair do backend).

---

## 10. Ensaio manual registrado

| Data | Cenário | Onde | Resultado |
|---|---|---|---|
| 2026-08-09 | Reconciliação (§3): representante sem `Subscription`, `Subscription` `provider = 'manual'` sem id externo, `external_subscription_id` inexistente contra a API real do Asaas | Banco de dev conectado + Asaas Sandbox real | `no_subscription`, `no_subscription`, `no_payment_found` — ver `supabase/README.md` §9 para o registro completo. Caminho "reconcilia uma divergência de verdade" **não ensaiado** (exigiria uma assinatura Sandbox real fora de sincronia, inexistente no momento — ADR-075/077). |
| 2026-08-10 | Evento duplicado (§4): mesmo `asaas_event_id` enviado duas vezes a `apply_billing_event()` | Banco de dev conectado, fixture descartável (criado e removido na mesma rodada) | 1ª chamada `outcome: 'applied'`, `subscriptions.status` `suspended → active`; 2ª chamada idêntica `outcome: 'duplicate'`, nenhuma escrita adicional; `billing_events` com exatamente 1 linha para o `asaas_event_id` ao final. |
| 2026-08-10 | Diagnóstico de entitlement divergente (§2, §5): consulta `active` com período vencido | Banco de dev conectado (dado real do projeto, não fixture) | Zero linhas — nenhuma divergência no momento do ensaio. Confirma que a query roda e retorna o formato esperado; não é prova de que a query captura todo tipo de divergência possível. |

**Não ensaiado, registrado como risco aceito (mesma categoria já aceita
pelos ADRs 075-077):** webhook parado de verdade (§3) — pausar a fila do
Asaas de propósito para testar a recuperação não foi feito, por ser
disruptivo contra o Sandbox compartilhado; e a correção manual de
entitlement divergente (§5) — não há, no momento, uma divergência real
para corrigir e ensaiar contra ela. A primeira execução real de qualquer
um dos dois deve ser observada de perto e este runbook atualizado com o
resultado, mesmo padrão que os ADRs de billing já seguem para os próprios
riscos aceitos.
