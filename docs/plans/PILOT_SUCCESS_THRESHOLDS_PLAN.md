# PILOT_SUCCESS_THRESHOLDS_PLAN.md

> Decisão de produto — thresholds numéricos de sucesso do piloto (SET-49).
> `ROADMAP.md` Stage 1 (VALIDATE) lista os critérios de sucesso só qualitativamente
> ("No numeric target has been set for any of these... Inventing numbers here
> would be worse than leaving them open") e marca o item 4 da exit condition
> ("qualitative evidence that they consider it worth paying for") como pending.
> Este documento é essa decisão.

**Status:** Approved — decisão tomada por Pedro em 2026-08-12.
**Authority:** Non-normative (ver `docs/plans/README.md`)
**Code baseline:** `5bbe987`, branch `develop`, em 2026-08-12.
**Last reviewed:** 2026-08-12
**Superseded by:** —

Mesmo contrato de `DATA_RETENTION_DECISIONS_PLAN.md` e `BILLING_DECISIONS_PLAN.md`:
este documento registra uma decisão de produto já tomada, com a fórmula e a
fonte de cada métrica — não instrumenta nada novo por si só.

---

# 1. Ancoragem

- **Cohort do piloto:** 30 vagas no preço de lançamento, R$ 27,90/mês
  (`BILLING_DECISIONS_PLAN.md` §4.4).
- **Retenção não é login diário.** `ROADMAP.md` Stage 1 rejeita explicitamente
  "daily usage" como critério — a pergunta é se a assinatura/presença continua
  ativa e gerando resultado, não se o representante loga.
- Cada métrica abaixo tem uma **fonte de dado já existente** no schema atual
  (nenhuma instrumentação nova é pré-requisito para medir; SET-50 cobre
  automação/dashboard operacional dessas leituras, não decisão de valor).

---

# 2. Métricas e thresholds

| Métrica | Fórmula | Janela | Fonte | 🟢 Verde | 🟡 Amarelo | 🔴 Vermelho |
|---|---|---|---|---|---|---|
| **Ativação** | Representantes com página publicada (perfil completo) / total cadastrado | ≤7 dias desde o cadastro | `representatives`, `product_activations` | ≥70% | 50–69% | <50% |
| **Resultado** | Representantes ativados com ≥1 lead OU ≥1 clique WhatsApp | ≤30 dias desde a ativação | `analytics_events`, `leads` | ≥50% | 30–49% | <30% |
| **Conversão paga** | Assinaturas pagas ativas (das 30 vagas) | Fim do piloto | `subscriptions` | ≥10/30 | 5–9/30 | <5/30 |
| **MRR** | Soma das mensalidades ativas no preço de lançamento (R$27,90 × conversões) | Fim do piloto | `subscriptions` | ≥R$279,00 (10×) | R$139,50–251,10 (5–9×) | <R$139,50 (5×) |
| **Retenção D30** | Assinantes que pagaram a 1ª cobrança e seguem ativos (não cancelados) 30 dias depois | D+30 pós-1ª cobrança | `subscriptions` | ≥80% | 50–79% | <50% |
| **Retenção D60** | Mesmo cálculo, em D+60 | D+60 pós-1ª cobrança | `subscriptions` | ≥70% | 50–69% | <50% |
| **Feedback positivo** | % de respostas positivas na pesquisa de percepção de valor (SET-62) | Acumulado no piloto | `feedback_responses` | ≥70% | 50–69% | <50% |

---

# 3. Critério de continuar, ajustar ou parar

**Confirmado por Pedro em 2026-08-12.**

- **Continuar sem mudanças:** nenhuma métrica em 🔴, e pelo menos 5 das 7 em 🟢.
- **Ajustar:** qualquer métrica em 🔴 fora de Conversão paga/Retenção D30, ou
  maioria das métricas em 🟡 — revisar o ponto fraco específico antes de
  decidir continuar ou escalar (ex.: ativação fraca → onboarding; resultado
  fraco → qualidade do catálogo/lead).
- **Parar/repensar a hipótese:** **Conversão paga** OU **Retenção D30** em 🔴
  — são as duas métricas que testam diretamente a hipótese do Stage 1
  ("representatives will pay for it [and stay]"); vermelho nelas significa que
  a hipótese central não se sustentou, não que falta ajuste operacional.

---

# 4. Fora de escopo, deliberadamente não decidido aqui

- **Automação da leitura dessas métricas** (dashboard, alertas) — rastreada
  como SET-50, consultas SQL documentadas em `docs/runbooks/PILOT_METRICS.md`.
- **Ajustes de preço/produto em resposta a um resultado 🟡/🔴** — decisão
  futura, condicionada ao resultado real, não antecipada aqui.
