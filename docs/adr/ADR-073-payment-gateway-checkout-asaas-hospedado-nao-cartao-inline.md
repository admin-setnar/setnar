### ADR-073 — `PaymentGateway` usa o Checkout Asaas hospedado, não cartão inline (SET-27)

**Status:** Accepted
**Date:** 2026-08-08
**Related:** Implementa `docs/plans/BILLING_DECISIONS_PLAN.md` §2.3 (Asaas
como gateway) e §6.1 (`payment_method` extensível no contrato); mesma forma
de porta/adapter/factory do ADR-041 (`RepresentativeOnboardingGateway`).
**Corrige uma decisão de implementação tomada mais cedo no mesmo dia**, sem
ADR próprio porque nunca chegou a ser revisada antes deste — ver *Contexto*.

#### Contexto e problema

A primeira implementação de `PaymentGateway.createSubscription` enviava os
dados do cartão (`creditCard`/`creditCardHolderInfo`) direto para
`POST /v3/subscriptions` a partir do nosso servidor Next.js. Um comentário
de código chamava isso de "follow-up operacional" a resolver depois. Ao
revisar a arquitetura antes de implementar o webhook (pedido explícito do
Pedro: "revise o plano para ter certeza que essa é a melhor decisão"), a
documentação do próprio Asaas (docs.asaas.com/docs/pci-dss-1) mostrou que
isso subestimava o risco: **o Asaas não oferece tokenização client-side** e
recomenda explicitamente que a aplicação seja **certificada em SAQ-D** — o
questionário de autoavaliação mais extenso do PCI-DSS — para quem envia
dados de cartão pela própria API. Isso nunca tinha sido escalado como
decisão de produto/compliance.

#### Alternativas consideradas

1. **Manter o envio inline e buscar certificação SAQ-D.** Rejeitada: custo
   de compliance real (segmentação de rede, scans trimestrais, possível
   auditoria por QSA) incompatível com o estágio do produto — MVP ainda
   validando disposição a pagar, sem nenhum cliente pagante ainda.
2. **Tokenizar o cartão via `/v3/creditCard/tokenize` antes de criar a
   assinatura.** Rejeitada: a própria documentação do Asaas afirma que essa
   funcionalidade "precisa ser solicitada ao gerente de conta" para uso em
   produção — não está garantida no lançamento, e mesmo tokenizado o dado
   bruto do cartão ainda transitaria pelo nosso servidor na chamada de
   tokenização em si.
3. **Checkout Asaas hospedado — página de pagamento no domínio do próprio
   Asaas.** Escolhida. `POST /v3/checkouts` com `chargeTypes: ['RECURRENT']`
   devolve uma URL para redirecionar o cliente; o cartão é digitado lá,
   nunca no nosso servidor. Ao ser pago, o Asaas cria uma assinatura normal,
   que gera os mesmos eventos `PAYMENT_*` de sempre — nenhuma mudança
   necessária no desenho já planejado para SET-29/30. Reduz drasticamente o
   escopo de PCI-DSS (aproximadamente equivalente a SAQ-A) e, como efeito
   colateral favorável, encaixa melhor no princípio já aprovado "redirect
   não concede entitlement": a própria documentação do Asaas confirma que
   "a criação do checkout não confirma o pagamento".
4. **Como o webhook (SET-29/30) vai casar o evento de pagamento com a linha
   local, já que os ids do Asaas só existem depois do pagamento?**
   `externalReference` no `POST /v3/checkouts` recebe o `id` da própria
   linha em `subscriptions` (já reservada por `reserve_billing_checkout_slot`,
   ADR-074) — o webhook lê esse campo de volta no payload de `CHECKOUT_PAID`.
   Elimina a necessidade de uma chamada autenticada síncrona de
   "gravar ids externos" logo após o checkout ser criado (que existia na
   primeira versão deste desenho, como `record_billing_external_ids`) —
   gravar os ids passa a ser responsabilidade exclusiva do webhook.

#### Decisão

`PaymentGateway` (domain) perde `createSubscription`/`CardDetails`/
`CardHolderInfo` e ganha `createCheckout(input): Promise<CreateCheckoutResult>`,
devolvendo `{ checkoutUrl, externalCheckoutId }`. `CreateCheckoutInput`
carrega `paymentMethod: PaymentMethod` — mesmo com um único valor legal
(`'credit_card'`) hoje, porque o Checkout Asaas também aceita `PIX`/`BOLETO`
em `billingTypes`; o adapter mapeia o valor de domínio para o `billingType`
do Asaas (`mapPaymentMethodToAsaasBillingType`), então Pix Automático entra
depois como um novo valor mapeado, não uma reescrita do contrato
(`BILLING_DECISIONS_PLAN.md` §6.1).

`AsaasPaymentGateway` (infrastructure) chama a REST API via `fetch`
diretamente — este projeto não depende do SDK do Asaas. Header de
autenticação das nossas chamadas ao Asaas é `access_token`; documentado
como distinto do header `asaas-access-token` que autentica as chamadas que
o Asaas nos envia (webhook, SET-29), para não confundir os dois ao
implementar aquele passo.

Nenhum campo de cartão (número, CVV, validade) existe em lugar nenhum do
código a partir deste ADR.

#### Consequências

- Escopo de PCI-DSS do SETNAR reduzido de SAQ-D (ou pior) para
  aproximadamente SAQ-A — o cartão nunca toca infraestrutura própria.
- O formulário de checkout (SET-28) fica reduzido a três campos (nome,
  documento, e-mail) em vez de onze (cartão + titular completo) — efeito
  colateral direto desta decisão, não um objetivo separado.
- SET-29/30 (webhook, sincronização de entitlement) permanecem praticamente
  inalterados: o evento `CHECKOUT_PAID` só adiciona um ponto de entrada que
  grava os ids externos + `current_period_end`; os eventos `PAYMENT_*`
  recorrentes de meses seguintes já eram o desenho planejado.
- Risco aceito, registrado: a exata mecânica de payload de `CHECKOUT_PAID`
  (nomes de campo dentro de `checkout.subscription`, se existe um id de
  assinatura explícito ali) não foi confirmada contra o sandbox real —
  verificar ao implementar SET-29, não assumir.
- Nenhuma credencial real do Asaas existe neste ambiente; o adapter nunca
  foi exercitado contra a API de verdade, só contra chaves fake (ver
  verificação abaixo) — SET-34 é responsável pela cobertura de sandbox real.

#### Verificação

Sem acesso a credenciais reais do Asaas neste ambiente. Verificado por:
`npm run verify` completo (typecheck, lint, 417 testes, integração, build)
limpo após a reescrita; smoke test manual no navegador (conta de teste real,
onboarding completo, `/app/conta`) confirmando que o formulário renderiza
só os três campos esperados e que a falha de configuração
(`ASAAS_API_KEY`/`ASAAS_BASE_URL` ausentes) é capturada por `safeBillingCall`
e mostrada como erro genérico, sem crash — nunca uma exceção não tratada.

#### Rollback conceitual

Reversão é puramente de aplicação, sem migration própria deste ADR (a
migration de SET-28 muda junto, ver ADR-074): restaurar
`createSubscription`/`CardDetails`/`CardHolderInfo` no port e no adapter, e
o formulário de onze campos. Não recomendado — reintroduziria a exposição a
SAQ-D que este ADR existe para eliminar.
