# DATA_RETENTION_DECISIONS_PLAN.md

> Decisão de produto — política de retenção de dados do MVP (SET-46), levantada
> pelo inventário técnico da SET-44 (`docs/plans/archive/AUDIT_SET-44_privacidade.md`)
> e pelo item AN7, registrado como pendente desde `docs/adr/ADR-065` e
> `docs/plans/QR_ANALYTICS_PLAN.md` §"AN7 — retenção/purga dos eventos".

**Status:** Approved — decisão tomada por Pedro em 2026-08-11. Implementação (rotina automática de purga) **não está incluída** — é o único item fora de escopo explícito da própria SET-46 ("Fora de escopo: Implementar jobs ou portal self-service") e vira uma issue técnica própria (ver §4).
**Authority:** Non-normative (ver `docs/plans/README.md`)
**Code baseline:** `48cfc8e`, branch `develop`, em 2026-08-11.
**Last reviewed:** 2026-08-11
**Superseded by:** —

Mesmo contrato de `BILLING_DECISIONS_PLAN.md`: este documento registra uma
decisão de produto já tomada, com a razão de cada escolha — não é este
documento que implementa a purga automática, só que fixa os números que uma
implementação futura precisa respeitar.

---

# 1. Categorias e decisão

## 1.1 Já implementado — só formalizado aqui como decisão aprovada

| Categoria | Prazo | Fonte técnica |
|---|---|---|
| Conta (`profiles`, `representatives`) | Enquanto a conta existir (`on delete cascade` de `auth.users`) | `20260728000000_create_profiles.sql`, `20260731000000_create_representative_domain.sql` |
| `login_attempts` | 1 dia (a janela de bloqueio de negócio é 15 min; a linha em si leva até 1 dia para ser apagada) | `20260729000000_fix_login_attempts_cleanup.sql:57-59` |
| `lead_submission_attempts.ip_hash` | 1 dia | `20260802000000_fix_submit_lead_rate_limit.sql:172-174` |

Nenhuma mudança de comportamento aqui — esses três já estavam corretos; SET-46
exigia decisão explícita mesmo para o que já existe ("hashes têm necessidade
após rate limit justificada ou remoção definida" é um critério de aceite
próprio), então ficam registrados.

## 1.2 Sem prazo até hoje — decisão nova

| Categoria | O que guarda | Decisão | Razão |
|---|---|---|---|
| `leads` | nome/telefone/e-mail/cidade do visitante (dado de terceiro, não do titular da conta) | **24 meses desde a última atualização da linha; depois, apagado** | Dado de terceiro capturado sem relação direta com SETNAR (é o representante quem tem a relação comercial) — LGPD pede minimização por finalidade. 24 meses cobre um ciclo de vendas longo sem virar retenção indefinida. |
| `analytics_events` (AN7) | `event_type`, `referrer`, `ip_hash` (pseudonimizado, salt próprio — ADR-054) | **12 meses desde `created_at`; depois, apagado** | Métrica de uso agregada perde valor operacional rápido; mesmo pseudonimizado, ainda é evento individual — não há razão de negócio para retenção indefinida. |
| `feedback_responses` | texto livre até 140 caracteres (inclui motivo de cancelamento, percepção de valor) | **Enquanto a conta do Representative existir** (mesmo ciclo de `profiles`/`representatives`) | Segue o padrão de cascade já usado para dado do titular; baixo volume, baixo custo de manter pelo ciclo de vida da conta. |
| `subscriptions` | status, valores, IDs do Asaas — **sem CPF/e-mail/endereço**, que ficam só no Asaas (SET-44 §1.6) | **Enquanto a conta existir** (mesmo ciclo de `profiles`) | É estado funcional do negócio (histórico de assinatura), não um registro fiscal em si — o documento fiscal de verdade é do Asaas. Obrigação tributária específica (se e por quanto tempo um registro *nosso* precisaria sobreviver ao cancelamento por motivo contábil) é pergunta para revisão jurídica/contábil — **não decidida aqui**, ver §3. |
| `billing_events` (payload minimizado desde SET-71/ADR-085 — já sem PII) | IDs do Asaas, status do evento, campos já extraídos e confiados pela matching logic | **Sem prazo definido por ora** — log técnico de idempotência/auditoria, não mais dado pessoal | Não há mais PII para "minimizar por tempo" depois da SET-71; é infraestrutura de idempotência do webhook, não um registro sobre um titular. Revisitar só se o volume virar problema de armazenamento, não por LGPD. |
| `billing_reconciliation_log` | ator/motivo/resultado de reconciliação manual — sem payload cru por desenho (`20260830000000:49-51`) | **Sem prazo definido** — trilha de auditoria operacional | Mesma lógica do item acima: baixíssimo volume (só rodadas manuais do script), sem PII por desenho desde a criação da tabela. |

---

# 2. Reconciliação com `DOMAIN_MODEL.md`

`DOMAIN_MODEL.md` já continha três referências a uma "retention policy" ainda
não definida — este documento é a resposta a essas três referências, não uma
mudança de modelo:

- §8.1/§8.2 ("preserves historical Leads and Analytics for the Company's
  record-keeping" / "for the Company's record-keeping") — sobre **o que
  acontece na desativação de um Representative**, não sobre por quanto tempo
  o dado sobrevive incondicionalmente. As duas regras coexistem: desativar um
  Representative não apaga Leads/Analytics na hora (DOMAIN_MODEL.md), *e* a
  janela de 24/12 meses definida aqui continua valendo independentemente do
  status do Representative.
- Linha 788 ("data retained per retention policy", evento `SubscriptionCanceled`)
  e linha 976 ("Lead cannot outlive its Representative (history retained per
  retention policy)") — apontavam para uma decisão futura. Essa decisão é
  este documento; as duas linhas ganham uma referência cruzada para cá.

---

# 3. Fora de escopo, deliberadamente não decidido aqui

- **Rotina automática de purga/anonimização.** Este projeto não tem
  infraestrutura de job/scheduler (`SPRINT_E_PLAN.md` §2.4) — decidir
  `pg_cron` vs. Vercel Cron vs. outra abordagem é uma decisão técnica própria,
  não uma decisão de produto. Rastreada como issue técnica nova (§4).
- **Aprovação jurídica formal do texto da política de privacidade.** Isso é
  SET-45, que continua pendente — a página `/privacidade` mantém o aviso de
  rascunho.
- **Obrigação contábil/fiscal específica sobre `subscriptions`** (se algum
  registro precisa sobreviver ao cancelamento por período legal de guarda
  fiscal). Sinalizado para revisão jurídica/contábil junto da SET-45, não
  decidido por engenharia nem pelo Product Owner isoladamente aqui.

---

# 4. Lacuna técnica aberta como Issue vinculada

[**SET-73**](https://linear.app/setnar/issue/SET-73/implementar-purga-automatica-de-leads-e-analytics-events-conforme) — Implementar a rotina de purga/anonimização automática
para `leads` (24 meses) e `analytics_events` (12 meses), conforme os prazos
aprovados neste documento. Decisão de mecanismo (pg_cron, Vercel Cron, ou
script manual documentado como interino) fica para essa issue, não para esta.
