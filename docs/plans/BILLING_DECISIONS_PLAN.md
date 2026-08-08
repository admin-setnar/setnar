# BILLING_DECISIONS_PLAN.md

> Plano de investigação — decisões comerciais do plano único (SET-6): gateway,
> preço/periodicidade, meios de pagamento e política de falha/cancelamento
> Escopo: `docs/ROADMAP.md` Stage 1, item "Payment gateway — no plan — the
> largest gap in the stage's own hypothesis"; `docs/DOMAIN_MODEL.md` §8.14 e
> §14 (lifecycle da Subscription); a lacuna que `docs/plans/SPRINT_E_PLAN.md`
> §2.4 registrou ("não existe infraestrutura de job/webhook neste projeto") e
> deixou consciente para este momento

**Status:** Approved — as quatro decisões (SET-22/23/24/25) estão fechadas; falta apenas mover as issues para `Done` no Linear
**Authority:** Non-normative (ver `docs/plans/README.md`)
**Code baseline:** `9859330`, branch `admin/set-11-corrigir-canonical-e-open-graph-das-paginas-publicas` (`main` no mesmo commit na prática — SET-11 já mergeado), em 2026-08-08.
**Last reviewed:** 2026-08-08
**Superseded by:** —

Mesmo contrato de `SPRINT_E_PLAN.md`: este documento **investiga e levanta
decisões, não fecha nenhuma sozinho**. Onde há custo de produto ou custo de
reversão alto, as opções vêm lado a lado, com prós/contras, e a escolha é do
Pedro. Cobre as quatro sub-issues de decisão do milestone "Decisões
bloqueadoras de billing" (Linear SET-6): **SET-22** (preço/periodicidade),
**SET-23** (gateway), **SET-24** (meios de pagamento), **SET-25** (política de
falha de cobrança e cancelamento).

---

# 1. Onde isso se encaixa no que já existe

`subscriptions` já existe no schema (ADR-033), com `status` (`active` por
default — armadilha já registrada em `SPRINT_E_PLAN.md` §2.3) e `provider =
'manual'`. O enforcement de leitura e escrita (`is_subscription_active`, gate
de publicação) já está implementado e **não muda com nenhuma decisão deste
documento** — ele opera sobre `subscriptions.status`, e continuará operando
assim independentemente de quem grava esse status (hoje: um UPSERT manual no
SQL Editor; depois de SET-16/28/29/30: um webhook de gateway).

`DOMAIN_MODEL.md` §8.14 já define o lifecycle-alvo: **Activated → Active →
(opcionalmente) Suspended (non-payment) → (opcionalmente) Canceled.** Isso já
é a forma que a Regra 21/§14 esperam — as decisões abaixo preenchem os
parâmetros desse lifecycle (quando suspender, quando cancelar), não inventam
um novo.

`SPRINT_E_PLAN.md` §2.4 registrou algo que pesa diretamente aqui: **não existe
nenhuma infraestrutura de job/webhook no projeto hoje.** Isso não bloqueia a
escolha de gateway, mas elimina de saída qualquer opção que dependa de um
processo periódico próprio "notando" que uma cobrança falhou — a escolha
precisa ser um provedor que **empurra** o evento (webhook), não um que exija
polling.

---

# 2. SET-23 — Seleção do gateway de pagamento

## 2.1 Critérios, na ordem que importa para este produto

1. **Cobrança recorrente de baixo ticket, sem infraestrutura de job própria** — o gateway precisa emitir webhook de cobrança paga/falhada; SETNAR só reage.
2. **Suporte nativo a Pix** — é o meio de pagamento dominante no Brasil hoje (>40% das transações online) e o público-alvo (representante autônomo, pagando do próprio bolso) é sensível a taxa de cartão.
3. **Custo fixo mensal baixo ou zero** — o MVP está validando *se* existe disposição a pagar, não otimizando margem; um plano com mensalidade fixa alta (Vindi: a partir de R$149/mês) é aposta cara antes da validação.
4. **Onboarding rápido para uma empresa nova** — SETNAR ainda está abrindo a própria conta em qualquer um desses provedores; KYC/aprovação lenta atrasa toda a Sprint E→billing automático.
5. **Documentação de webhook e idempotência** — é o que SET-29 (webhook autenticado e idempotente) vai consumir diretamente.

## 2.2 Comparativo

| Gateway | Recorrência (assinatura) | Pix nativo/automático | Boleto | Custo fixo mensal | Taxa cartão recorrente | Taxa Pix | Observação |
|---|---|---|---|---|---|---|---|
| **Asaas** | Sim, `subscriptions` na API | Sim — cobrança Pix sem taxa de emissão (só na liquidação) e já documenta Pix Automático | Sim | R$ 0 (planos por transação) | 1,99% + R$0,49/cobrança | R$0,99–1,99/cobrança liquidada | Foco declarado em cobrança recorrente e boleto; API única cobre os três meios |
| **Mercado Pago** | Sim — "Planos de Assinatura"/preapproval, frequência configurável, retry automático embutido | Sim — Pix a partir de 0,99%, e já cita Pix Automático para assinaturas em 2026 | Sim | R$ 0 | a partir de 3,99% (D+30) | a partir de 0,99% | Marca mais reconhecida pelo usuário final no Brasil — pode reduzir fricção/desconfiança no checkout |
| **Pagar.me (Stone)** | Sim, mas o produto é otimizado para marketplace/split — recurso que este MVP não usa | Documentação de webhook robusta (assinatura HMAC) | Sim | Variável (negociado) | Variável (adquirente) | Variável | Overkill de funcionalidade para "um plano único, um lado só recebendo" |
| **Vindi** | Sim — é o core do produto, régua de cobrança e reemissão automática de cartão vencido inclusos | Pix recorrente via parceiro | Sim (R$3,50/boleto pago) | **A partir de R$149/mês fixo** | 2,85–4,14% | — | Melhor "billing engine" pronto, mas o fixo mensal é caro para validar hipótese com poucos clientes iniciais |
| **Stripe** | Sim (Billing), robustíssimo internacionalmente | **Pix apenas "para convidados" no Brasil hoje** — não é self-serve para conta brasileira nova | Sim, mas sem confirmação clara de recorrência nativa | R$ 0 | ~3,99%+ | Limitado | Melhor DX do mercado, mas o gap de Pix nativo é grave para o público-alvo deste produto |

## 2.3 Decisão — **Asaas confirmado por Pedro em 2026-08-08**

Contra Vindi e Stripe, pelas mesmas razões já levantadas: fixo mensal alto
demais para a fase de validação (Vindi) e Pix não self-serve para conta
brasileira nova (Stripe).

Entre Asaas e Mercado Pago, a decisão foi Asaas. Razões que pesaram:

1. **Custo de transação.** Cartão 1,99% + R$0,49 contra "a partir de 3,99%"
   do Mercado Pago não é uma diferença marginal — numa faixa de preço de
   R$29–59/mês (§4.3), cada ponto percentual de taxa é uma fração relevante
   da própria mensalidade, e isso importa mais numa fase com poucos clientes
   do que numa fase de escala.
2. **Repasse mais rápido**, contra D+30 do cartão no Mercado Pago — ajuda
   caixa numa fase sem receita recorrente estabelecida.
3. **Documentação de Pix Automático mais madura** — reduz risco de
   implementação para SET-29 (webhook) e para a reavaliação de SET-24 quando
   Pix Automático entrar como meio adicional.

O reconhecimento de marca do Mercado Pago no checkout (o representante
provavelmente já usa Mercado Pago no dia a dia) é um argumento real, mas de
conversão — não de custo nem de risco técnico. Numa fase que ainda está
testando "será que pagam", taxa mais baixa e caixa mais rápido pesam mais do
que uma fricção de checkout ainda não medida.

**Nota para SET-27 (boundary/adapter):** o Asaas deve ficar atrás de uma
porta própria (padrão já usado no projeto — `RepresentativeOnboardingGateway`,
ADR-041), para que uma eventual migração de provedor no futuro não vaze para
`set_activation_status` nem para a policy de leitura.

---

# 3. SET-24 — Meios de pagamento aceitos

## 3.1 O que cada meio realmente entrega para recorrência

- **Cartão de crédito.** Único meio hoje com recorrência "silenciosa" madura
  no Brasil (tokenização, nova tentativa automática, reemissão em caso de
  cartão vencido nos gateways mais robustos). Taxa mais alta, mas é o que
  sustenta a maior parte do SaaS recorrente no país até aqui.
- **Pix avulso (QR estático por cobrança).** **Não é recorrência real** — o
  cliente precisa pagar manualmente a cada ciclo. Usar isso como único meio
  reproduziria manualmente o mesmo problema que SET-6 existe para resolver
  (ninguém cobra automaticamente).
- **Pix Automático.** Modalidade nova do Banco Central, em produção desde
  junho de 2025, com prazo regulatório de adequação em 1º de janeiro de 2026
  para quem usava débito automático tradicional — ou seja, está no ar agora,
  não é uma aposta de médio prazo. Adesão de 73% entre clientes que receberam
  o pedido de autorização direto no app do banco, segundo dado do próprio
  setor.
- **Boleto.** Ruim para recorrência automática por natureza: reemissão manual
  a cada ciclo, compensação em D+1/D+2, e é o meio com maior taxa de
  inadimplência do mercado. Só faz sentido se o público-alvo tiver parcela
  relevante sem cartão nem conta bancária com Pix — pouco provável para
  representantes comerciais autorizados (perfil profissional, não
  desbancarizado).

## 3.2 O que mudou depois de SET-23 fechar em Asaas

Levantei a mecânica real do Pix Automático no Asaas, e ela pesa contra
incluí-lo já no lançamento:

- **Elegibilidade gradual, não garantida.** O Asaas libera Pix Automático
  para contas PJ progressivamente, seguindo critérios do próprio Banco
  Central — a conta do SETNAR ainda não existe no Asaas, então não há como
  confirmar hoje que ela nasce elegível.
- **Fluxo de consentimento em duas etapas ("Jornada 3"), diferente do
  cartão.** O pagador paga a primeira cobrança via Pix normal e só depois é
  convidado a autorizar o Pix Automático para as próximas — não é "ativa e
  já está recorrente" como o cartão tokenizado. Isso é uma segunda jornada
  de checkout inteira, não uma opção a mais no mesmo formulário.

## 3.3 Decisão — **confirmada por Pedro em 2026-08-08**

**Só cartão de crédito no lançamento. Pix Automático fica para uma iteração
seguinte, assim que a conta Asaas do SETNAR confirmar elegibilidade. Boleto
fora do escopo do MVP.**

Justificativa: cartão é o único meio garantido — não depende de elegibilidade
de conta que ainda não existe, nem de uma segunda jornada de consentimento
inteira dentro do SET-28 (checkout). Construir os dois fluxos de pagamento
antes de saber se a conta Asaas é elegível para o segundo é o mesmo tipo de
risco que o próprio SET-6 nomeia para o gateway: acoplar implementação a algo
ainda não confirmado. Excluir boleto reduz superfície de inadimplência e de
suporte (reemissão manual) num momento em que o produto não tem operação
para lidar com isso.

Isso reduz o escopo de SET-28 a um único fluxo de checkout na v1 (cartão), o
que é coerente com "small scope, fast delivery" (`ROADMAP.md`, Release
Strategy). Pix Automático permanece a evolução natural do meio de pagamento
assim que (a) a conta Asaas confirmar elegibilidade e (b) houver sinal real
de que o cartão está sendo motivo de recusa na validação.

---

# 4. SET-22 — Preço e periodicidade do plano único

## 4.1 Referência de mercado

Não existe benchmark direto ("Digital Office" é categoria nova), mas o
comparável mais próximo encontrado — uma ferramenta de presença digital para
corretor autônomo (página + captação de lead) — pratica **R$64/mês no plano
mensal, R$54,40/mês no semestral**, sem taxa de adesão nem fidelidade. Isso
ancora a faixa: um representante autônomo brasileiro já demonstrou disposição
a pagar em torno de R$50–65/mês por uma ferramenta de presença digital
individual, em categoria adjacente.

## 4.2 Opções

**Opção A — Preço único, sem desconto por periodicidade (recomendo para o
MVP).** Um valor mensal, cobrado mensalmente, sem plano anual. Simplifica ao
extremo: uma única SKU no gateway, um único fluxo de checkout, nenhuma lógica
de proration (`PRODUCT.md` já lista proration como fora de escopo). Alinhado
ao "não invente parâmetros" do próprio SET-6 — cada variação de periodicidade
é mais uma decisão implícita sobre cancelamento/reembolso proporcional que o
MVP não precisa responder ainda.

**Opção B — Mensal + anual com desconto.** Ajuda fluxo de caixa e reduz churn
técnico (menos eventos de cobrança por cliente/ano), mas exige decidir
reembolso proporcional em cancelamento antecipado do anual — exatamente o
tipo de regra que `PRODUCT.md` marcou como fora de escopo ("proration").
Faz mais sentido **depois** que o plano mensal validar a hipótese.

## 4.3 Faixa de preço sugerida

Sem inventar o número final — isso é decisão do Pedro — mas a faixa
defensável, dado o comparável de mercado e o público (profissional autônomo
pagando do próprio bolso, ainda sem prova de ROI mensurável dentro do
produto — `ROADMAP.md` Stage 1 admite que estatísticas não são mostradas ao
representante ainda): **R$29–59/mês**. Abaixo do comparável de R$64/mês do
corretor porque SETNAR ainda não entrega analytics visível nem prova de
resultado ao representante (`ROADMAP.md`, "Still open in Stage 1") — cobrar
no mesmo patamar de um produto que já mostra resultado, antes de mostrar
resultado, é fricção adicional numa fase que já está testando disposição a
pagar.

## 4.4 Decisão — **preço de lançamento confirmado por Pedro em 2026-08-08**

**R$27,90/mês, cobrança mensal, para os 30 primeiros clientes pagantes.**
Fixo enquanto o representante mantiver a assinatura ativa — não é uma
promoção com prazo, é um preço fidelizado ("founding customers"). Abaixo da
própria faixa sugerida em §4.3, o que é coerente com o objetivo de reduzir
fricção máxima na validação: R$27,90 é um ticket baixo o suficiente para não
ser, sozinho, motivo de recusa — o que isola melhor a hipótese real do MVP
("o representante vê valor nisso?") do ruído de "achei caro".

**Periodicidade:** só mensal, conforme Opção A (§4.2) — sem plano anual no
lançamento.

**Em aberto, e não decidido aqui:**

- **Preço padrão pós-lançamento** (para quem assinar depois que as 30 vagas
  se esgotarem). Pedro optou por não fixar esse número agora e revisitar com
  dado real da validação — a faixa de §4.3 (R$29–59/mês) segue como
  referência quando essa decisão for tomada.
- **Mecânica de limite das 30 vagas.** Este documento decide o *preço*, não
  a implementação. Precisa de uma forma de contar quantas Subscriptions já
  nasceram no preço de lançamento e impedir uma 31ª — não é uma migration
  nova (uma contagem de linhas em `subscriptions` já responde "quantos
  ativaram no preço de lançamento"), mas **é** uma regra de negócio que o
  checkout (SET-28) precisa aplicar antes de criar a cobrança, não depois.
  Cabe a SET-28, não a este documento, decidir exatamente onde essa checagem
  vive.
- **Como o preço fica gravado.** Como o preço agora varia por cliente (não é
  mais "o valor do plano", é "o valor que este representante fechou"),
  `subscriptions` precisa guardar o valor cobrado por linha, não depender de
  uma constante fixa no código — isso é uma implicação direta para SET-26
  (modelagem do lifecycle/contrato de entitlement), registrada aqui para não
  se perder até lá.

---

# 5. SET-25 — Política de falha de cobrança e cancelamento

## 5.1 Mecânica real do Asaas (levantada após SET-23 fechar em Asaas)

Documentação do Asaas confirma um comportamento concreto, que substitui a
estimativa genérica da versão anterior deste documento:

- No vencimento, o Asaas faz **3 tentativas automáticas no próprio dia**
  (a cada 6h — 8h, 14h, 20h) e, se ainda falhar, **mais 2 tentativas no dia
  seguinte** — **5 tentativas ao todo, encerradas em até 2 dias após o
  vencimento**.
- Esgotadas as tentativas, a cobrança fica **vencida** e **não há mais
  retry automático** — o pagador precisa acessar a fatura e reinserir um
  cartão válido manualmente.
- **Webhooks do Asaas são por cobrança (`PAYMENT_*`), não por assinatura.**
  Cada evento carrega o `subscription` a que pertence — é assim que SET-29
  vai amarrar o evento à linha certa em `subscriptions`. Não existe um
  webhook nativo de "assinatura suspensa"; quem decide suspender é o próprio
  SETNAR, reagindo ao evento de cobrança vencida sem mais tentativas.

## 5.2 Decisão — falha de cobrança, **confirmada por Pedro em 2026-08-08**

**Suspender assim que o Asaas esgotar as tentativas (~2 dias após o
vencimento), sem janela de tolerância adicional própria.**

1. Cobrança vence → Asaas tenta 5x em até 2 dias → durante essa janela,
   `subscriptions.status` permanece `active` (é o próprio Asaas tentando,
   SETNAR não faz nada além de aguardar o webhook conclusivo).
2. Cobrança esgota as tentativas sem sucesso → webhook `PAYMENT_*` conclusivo
   chega → `subscriptions.status` vai para `suspended`. Comportamento já
   existente é reaproveitado sem mudança: a policy pública deixa de resolver
   a página (E1), o hub mostra o terceiro estado visual já implementado em
   E4 ("publicado, mas assinatura inativa"). Nenhum dado é apagado;
   `product_activations.status` permanece `published`.
3. Pagador regulariza (reinsere cartão válido na fatura) a qualquer momento
   → webhook de pagamento confirmado → mesmo UPSERT de hoje (caminho de E3,
   agora disparado pelo webhook) volta `status` para `active`.

Por que sem tolerância extra: o Asaas já dá 2 dias e 5 tentativas de chance
— é o próprio provedor absorvendo falhas transitórias (saldo momentâneo,
bloqueio temporário). Adicionar um timer próprio por cima exigiria guardar
"quando venceu" e checar prazo periodicamente, que é exatamente o tipo de
infraestrutura de job que `SPRINT_E_PLAN.md` §2.4 registrou que o projeto
conscientemente não tem — e o SETNAR continua 100% reativo a webhook, sem
polling.

## 5.3 Decisão — cancelamento, **confirmada por Pedro em 2026-08-08**

**Efetivo no fim do ciclo já pago, não imediato.** O representante cancela,
mas a Subscription continua `active` até o fim do período que já pagou; a
próxima cobrança simplesmente não é gerada (removendo a assinatura no Asaas
no momento do pedido de cancelamento — "Remover assinatura" já impede novas
cobranças futuras sem afetar o acesso local, que é controlado pelo próprio
`subscriptions.status`/data de vigência no SETNAR, não pelo estado da
assinatura no Asaas). Evita reembolso proporcional (fora de escopo,
`PRODUCT.md`) e não descarta dias já pagos de um representante que pode
estar no meio de uma campanha ativa com o link publicado.

**Implicação direta para SET-26 (lifecycle/schema), registrada aqui para não
se perder até lá:** isso exige que `subscriptions` distinga "cancelado, mas
ainda dentro do período pago" de "suspenso por falha de pagamento" — hoje o
enum só usa `active`/`suspended` de fato. `DOMAIN_MODEL.md` §8.14 já prevê um
terceiro estado (`Canceled`) no lifecycle-alvo, ainda não usado no código.
SET-26 também precisa de uma data de vigência (fim do ciclo pago) para saber
até quando um `canceled` continua contando como acesso válido — não é mais
suficiente que `is_subscription_active()` olhe só para `status`.

---

# 6. Resumo das recomendações (para revisão rápida do Pedro)

| Decisão | Issue | Recomendação | Reversibilidade se errado |
|---|---|---|---|
| Gateway | SET-23 | **Asaas — decidido** (2026-08-08) | Média — mitigada se SET-27 isolar o gateway atrás de um adapter |
| Meios de pagamento | SET-24 | **Decidido** — só cartão no lançamento; Pix Automático fica para depois da conta Asaas confirmar elegibilidade; boleto fora do MVP | Alta — adicionar um meio depois é aditivo |
| Preço | SET-22 | **R$27,90/mês — decidido**, fixo para os 30 primeiros clientes; preço padrão pós-lançamento fica em aberto | Alta — preço de SaaS é o parâmetro mais barato de ajustar depois, mas o registro do preço por Subscription (§4.4) precisa existir desde já |
| Periodicidade | SET-22 | **Só mensal — decidido** | Alta — anual pode ser adicionado depois sem quebrar nada |
| Falha de cobrança | SET-25 | **Decidido** — suspender assim que o Asaas esgotar as 5 tentativas (~2 dias após vencimento), sem tolerância extra; reaproveita E1/E4 já implementados | Alta — é um parâmetro reativo a webhook, não uma migration |
| Cancelamento | SET-25 | **Decidido** — efetivo no fim do ciclo pago; requer estado `canceled` distinto de `suspended` e data de vigência | Média — muda o enum de `subscriptions.status` e adiciona uma data, mas é aditivo |

---

# 7. O que falta para fechar SET-6

Segundo os critérios de aceite do próprio SET-6:

- [x] Pedro escolhe o gateway (§2.3) — **Asaas, confirmado em 2026-08-08.**
- [x] Pedro confirma preço e periodicidade (§4.4) — **R$27,90/mês, fixo para
      os 30 primeiros clientes, só mensal, confirmado em 2026-08-08.** Preço
      padrão pós-lançamento fica para uma decisão futura.
- [x] Pedro confirma meios de pagamento (§3.3) — **só cartão no lançamento;
      Pix Automático fica para depois da conta Asaas confirmar elegibilidade;
      boleto fora do MVP, confirmado em 2026-08-08.**
- [x] Pedro confirma a política de falha de cobrança e cancelamento (§5.2/§5.3)
      — **suspender ao esgotar as 5 tentativas do Asaas (~2 dias), cancelamento
      efetivo no fim do ciclo pago, confirmado em 2026-08-08.**
- [ ] Este documento (ou seu conteúdo) referenciado nas issues SET-22/23/24/25
      como a decisão registrada, e as issues movidas para `Done` no Linear.

**As quatro decisões de conteúdo estão fechadas.** Só falta o passo
administrativo: mover SET-22/23/24/25 (e o próprio SET-6) para `Done` no
Linear — isso não depende mais de nenhuma investigação, só de revisão final
do Pedro. A partir daí, os itens de implementação (SET-16, 26–35) podem
começar sem o risco que o próprio SET-6 nomeia: "retrabalho e acoplamento ao
gateway se implementação começar antes das decisões."
