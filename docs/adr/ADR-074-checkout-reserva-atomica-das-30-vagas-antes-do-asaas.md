### ADR-074 — Checkout reserva a vaga/preço atomicamente antes de tocar o Asaas (SET-28)

**Status:** Accepted
**Date:** 2026-08-08
**Related:** Implementa `docs/plans/BILLING_DECISIONS_PLAN.md` §4.4 (as 30
vagas de lançamento a R$27,90); depende do port `PaymentGateway.createCheckout`
do ADR-073; mesma convenção `null`-means-failure/`redirect()`-means-success
do ADR-045, aplicada ao caso que termina em `redirect()`.

#### Contexto e problema

SET-22 decidiu R$27,90/mês fixo para os 30 primeiros clientes que passarem
pelo checkout automatizado (`provider != 'manual'`). Sem nenhuma escrita
local antes de chamar o Asaas, duas requisições de checkout concorrentes
poderiam ambas passar por uma checagem de "quantas vagas já foram usadas",
ambas criarem um checkout no Asaas, e só depois uma delas conseguir gravar
localmente — dinheiro real em rota de cobrança sem uma vaga local
correspondente, ou pior, sem nenhum jeito limpo de desfazer o checkout já
criado no gateway.

#### Alternativas consideradas

1. **Contar as vagas na aplicação (Node/TypeScript), decidir o preço, e só
   então gravar.** Rejeitada: a contagem e a decisão aconteceriam fora de
   uma transação, sem lock — a mesma corrida do parágrafo acima, só que
   ainda mais larga (round-trips de rede entre a contagem e a escrita).
2. **Uma tabela de controle dedicada (`billing_founding_cohort_counter`,
   uma linha, incrementada com `select ... for update`).** Rejeitada por
   ora: funciona, mas introduz uma tabela nova só para um contador que
   `count(*) from subscriptions where provider <> 'manual'` já responde
   corretamente — a única coisa que faltava era serializar o
   contar-e-decidir, não guardar um número à parte.
3. **`pg_advisory_xact_lock` dentro da própria função `security definer` que
   já faz a contagem e o insert.** Escolhida: serializa qualquer
   concorrência na mesma transação, sem tabela nova, liberado
   automaticamente no commit/rollback. `reserve_billing_checkout_slot()`
   passa a: resolver o representante via `auth.uid()`; se já existe uma
   linha, tratar como retry (reusa preço e id, sem consumir vaga nova) ou
   bloquear se já ativa; senão, contar e decidir sob o lock, inserindo com
   `status = 'suspended'` (não `'active'` — ninguém pagou ainda).
4. **Reservar a vaga só DEPOIS que o Asaas confirmar a criação do
   checkout.** Rejeitada: se a chamada ao Asaas falhar depois de "reservado
   mentalmente" mas antes de gravar, a contagem local nunca refletiria a
   tentativa — mas problema pior, se a ORDEM fosse invertida (Asaas
   primeiro), uma falha ao gravar localmente DEPOIS de criar o checkout no
   Asaas deixaria um checkout órfão, sem nenhuma vaga local reservada para
   ele. Escolhida a ordem oposta: reservar primeiro (barato, reversível,
   sem efeito externo), chamar o Asaas depois — uma falha do Asaas só deixa
   uma linha `suspended` sem ids externos, que a própria pessoa pode tentar
   de novo sem custo.
5. **O que a Server Action devolve em caso de sucesso.** Como o resultado
   agora é sempre um redirecionamento para o domínio do Asaas (não mais um
   "pendente" renderizado in-line, ver ADR-073), `startCheckoutAction`
   segue a convenção de `registerRepresentativeAction` (ADR-042): chama
   `redirect()` dentro do callback de `safeBillingCall`, e um retorno normal
   da função é sempre falha — não a convenção `null`-means-success de
   `activateProductAction`/`updateRepresentativeProfileAction` (ADR-045),
   que existe especificamente para ações que NÃO navegam.

#### Decisão

Migration `20260824000000_add_billing_checkout_functions.sql`:
`reserve_billing_checkout_slot()` (`security definer`, `grant` só a
`authenticated`) devolve `(id, status, amount_cents)`; `get_own_subscription_view()`
(leitura, mesmo padrão) devolve os campos que a UI de `/app/conta` precisa
para decidir entre mostrar o formulário, um estado de espera, ou a
assinatura ativa.

`src/modules/billing/application/start-checkout.ts` orquestra: reserva →
`createCustomer` → `createCheckout` (com o `id` local como
`externalReference`, ADR-073) → devolve a URL para redirecionar. Nunca
`'active'` — só o webhook (SET-29/30) concede entitlement.

`src/app/app/conta/page.tsx` ganha a seção "Assinatura" e passa a ler
`?checkout=success|canceled|expired` (as três URLs de callback que
`startCheckoutAction` gera): sem isso, alguém que acabasse de pagar com
sucesso veria o formulário de novo ao voltar, porque `hasExternalSubscription`
só fica verdadeiro quando o webhook (ainda não implementado) grava os ids —
`checkoutJustSucceeded` mostra "aguardando confirmação" nesse intervalo,
sem nunca declarar a assinatura ativa antes da hora.

#### Verificação

Testado duas vezes contra o banco de desenvolvimento conectado: (1) lógica
isolada, com uma cópia da função recebendo `representative_id` por
parâmetro (contornando `auth.uid()`, indisponível numa conexão SQL direta)
e um limite de vagas artificialmente baixo — reserva nova, vaga esgotada,
retry reusa a linha, `already_active` bloqueia, todos passando. (2) fim a
fim, pelo navegador, com uma conta real criada via onboarding completo,
credenciais fake do Asaas temporárias para permitir a chamada real ao
gateway (que falha, esperado) — confirmado que `reserve_billing_checkout_slot()`
roda com `auth.uid()` de verdade e cria a linha (`status='suspended'`,
`provider='asaas'`, `amount_cents=2790`), e que uma segunda submissão reusa
a mesma linha (mesmo `id`, mesmo `created_at`) em vez de duplicar. Dados de
teste e credenciais fake removidos ao final; nenhum resquício no banco.

Achado durante o re-teste: `returns table (id uuid, ...)` cria uma variável
PL/pgSQL `id` que colide com `returning id` do `INSERT` — erro em tempo de
execução, invisível em `apply_migration` (só valida DDL, não executa).
Corrigido qualificando como `returning subscriptions.id`.

#### Consequências

- Nenhuma corrida possível nas 30 vagas — testado, não só argumentado.
- Uma falha do gateway nunca desperdiça uma vaga: a mesma linha reservada é
  reusada em qualquer nova tentativa.
- `?checkout=success` sem o webhook implementado ainda produz a mensagem
  certa ("aguardando confirmação"), mas a ativação de verdade só acontece
  quando SET-29/30 existir — até lá, uma assinatura paga no Asaas fica
  presa em `suspended` no lado local indefinidamente. Risco aceito e
  esperado nesta fatia; não bloqueador para revisão, mas SET-29/30 é o
  próximo passo obrigatório antes de qualquer uso real.
- Preço padrão pós-lançamento (o que cobrar depois que as 30 vagas
  esgotarem) permanece decisão em aberto, registrada em
  `BILLING_DECISIONS_PLAN.md` §4.4 — `sold_out` hoje bloqueia o checkout em
  vez de inventar um número.

#### Rollback conceitual

Reversão de aplicação: remover a seção "Assinatura" de `page.tsx`, o
módulo `billing` (`start-checkout.ts`, `actions.ts`, `checkout-form.tsx` e
schemas), e as duas funções desta migration
(`drop function reserve_billing_checkout_slot()`,
`drop function get_own_subscription_view()`). Nenhuma linha de
`subscriptions` precisa ser apagada — `suspended` sem ids externos é um
estado válido e inofensivo mesmo sem o código que o criou.
