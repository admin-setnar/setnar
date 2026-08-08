# BILLING_DECISIONS_PLAN.md

> Plano de investigação — decisões comerciais do plano único (SET-6): gateway,
> preço/periodicidade, meios de pagamento e política de falha/cancelamento
> Escopo: `docs/ROADMAP.md` Stage 1, item "Payment gateway — no plan — the
> largest gap in the stage's own hypothesis"; `docs/DOMAIN_MODEL.md` §8.14 e
> §14 (lifecycle da Subscription); a lacuna que `docs/plans/SPRINT_E_PLAN.md`
> §2.4 registrou ("não existe infraestrutura de job/webhook neste projeto") e
> deixou consciente para este momento

**Status:** Proposed — SET-23 (gateway) decidido; SET-22, SET-24 e SET-25 seguem abertos
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
  para quem usava débito automático tradicional — ou seja, **está no ar
  agora**, não é uma aposta de médio prazo. Adesão de 73% entre clientes que
  receberam o pedido de autorização direto no app do banco, segundo dado do
  próprio setor. Taxas na casa de centavos/percentuais bem baixos (0,22–0,35%
  citado por uma fonte). Ainda é a modalidade mais nova das três — vale
  confirmar cobertura em ambos os gateways candidatos antes de depender dela
  como único meio.
- **Boleto.** Ruim para recorrência automática por natureza: reemissão manual
  a cada ciclo, compensação em D+1/D+2, e é o meio com maior taxa de
  inadimplência do mercado. Só faz sentido se o público-alvo tiver parcela
  relevante sem cartão nem conta bancária com Pix — pouco provável para
  representantes comerciais autorizados (perfil profissional, não
  desbancarizado).

## 3.2 Recomendação

**Cartão de crédito como meio primário (obrigatório para o MVP funcionar sem
job próprio), Pix Automático como meio alternativo assim que confirmada a
cobertura no gateway escolhido, boleto fora do escopo do MVP.**

Justificativa: cartão é o único meio, hoje, com recorrência automática
comprovada nos dois gateways candidatos e sem dependência de o banco do
cliente já ter aderido ao Pix Automático. Excluir boleto reduz superfície de
inadimplência e de suporte (reemissão manual) num momento em que o produto
não tem operação para lidar com isso. Pix Automático deve ser reavaliado como
meio adicional — não substituto — assim que SET-23 estiver fechado, checando
a documentação de API do gateway escolhido especificamente para esse fluxo
(a integração de Pix Automático via API ainda é mais nova que a de cartão em
ambos os candidatos).

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

---

# 5. SET-25 — Política de falha de cobrança e cancelamento

## 5.1 Falha de cobrança (dunning)

Segue o padrão já citado como boa prática de mercado e compatível com o que
os dois gateways candidatos oferecem nativamente (retry embutido em
assinaturas):

1. Cobrança falha → gateway dispara webhook de falha → `subscriptions.status`
   permanece `active` durante uma **janela de tolerância curta** (recomendo
   3 dias corridos), para absorver falhas transitórias (saldo insuficiente
   momentâneo, cartão temporariamente bloqueado).
2. Nova tentativa automática do gateway (a maioria já reenvia em D+1/D+3;
   confirmar a régua exata do provedor escolhido em SET-23 antes de
   implementar SET-29).
3. Se todas as tentativas falharem dentro da janela: `status` vai para
   `suspended`. Isso já é o comportamento existente — a policy pública deixa
   de resolver a página (E1, já implementado), o hub mostra o terceiro estado
   visual já implementado em E4 ("publicado, mas assinatura inativa"). Nenhum
   dado é apagado; `product_activations.status` permanece `published` (mesma
   decisão de design de E1 — despublicar é irreversível, suspender não é).
4. Pagamento regularizado a qualquer momento → um único UPSERT (mesmo
   caminho de E3, agora disparado pelo webhook em vez de manualmente) volta
   `status` para `active` e a página volta a resolver, sem reprocessamento
   manual.

## 5.2 Cancelamento

**Opção A — Cancelamento efetiva no fim do ciclo já pago (recomendo).** O
representante cancela, mas continua com a Subscription `active` até o fim do
período que já pagou; a próxima cobrança simplesmente não é gerada. Evita
reembolso proporcional (fora de escopo, `PRODUCT.md`) e é o padrão mais comum
em SaaS de assinatura mensal simples.

**Opção B — Cancelamento imediato.** Mais simples de explicar ao usuário
("cancelei, já não tenho acesso"), mas descarta dias já pagos sem
justificativa visível para quem pagou — mais difícil de defender numa
categoria (representação comercial) onde o representante pode estar no meio
de uma campanha ativa com o link publicado.

Recomendo A. Requer que `subscriptions` saiba distinguir "cancelado, mas
ainda dentro do período pago" de "suspenso por falha de pagamento" — hoje o
enum não faz essa distinção (só `active`/`suspended` estão em uso real). Isso
é uma decisão de schema pequena que cabe em SET-26 (lifecycle da assinatura),
não neste documento — aqui só fica registrado que a política escolhida
**exige** esse terceiro estado (`canceled`, já previsto em `DOMAIN_MODEL.md`
§8.14, ainda não usado no código).

---

# 6. Resumo das recomendações (para revisão rápida do Pedro)

| Decisão | Issue | Recomendação | Reversibilidade se errado |
|---|---|---|---|
| Gateway | SET-23 | **Asaas — decidido** (2026-08-08) | Média — mitigada se SET-27 isolar o gateway atrás de um adapter |
| Meios de pagamento | SET-24 | Cartão obrigatório; Pix Automático assim que confirmada a cobertura no gateway escolhido; boleto fora do MVP | Alta — adicionar um meio depois é aditivo |
| Preço | SET-22 | R$29–59/mês, plano único, sem anual por ora | Alta — preço de SaaS é o parâmetro mais barato de ajustar depois |
| Periodicidade | SET-22 | Só mensal no MVP | Alta — anual pode ser adicionado depois sem quebrar nada |
| Falha de cobrança | SET-25 | Janela de tolerância de 3 dias + retry do gateway, depois suspensão (reaproveita E1/E4 já implementados) | Alta — janela é um parâmetro, não uma migration |
| Cancelamento | SET-25 | Efetivo no fim do ciclo pago; requer estado `canceled` distinto de `suspended` | Média — muda o enum de `subscriptions.status`, mas é aditivo |

---

# 7. O que falta para fechar SET-6

Segundo os critérios de aceite do próprio SET-6:

- [x] Pedro escolhe o gateway (§2.3) — **Asaas, confirmado em 2026-08-08.**
- [ ] Pedro confirma ou ajusta a faixa de preço (§4.3) e a decisão de
      "só mensal por ora" (§4.2).
- [ ] Pedro confirma meios de pagamento (§3.2) — em especial se Pix
      Automático entra já no MVP ou fica para uma iteração seguinte.
- [ ] Pedro confirma a janela de tolerância e a política de cancelamento
      no fim do ciclo (§5).
- [ ] Este documento (ou seu conteúdo) referenciado nas issues SET-22/23/24/25
      como a decisão registrada, e as issues movidas para `Done` no Linear.

Nenhum item de implementação (SET-16, 26–35) deve começar antes desses cinco
pontos — é exatamente o risco que o próprio SET-6 nomeia: "retrabalho e
acoplamento ao gateway se implementação começar antes das decisões."
