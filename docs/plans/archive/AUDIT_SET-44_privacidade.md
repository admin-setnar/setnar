Status: Implemented — archived
Authority: Non-normative
Code baseline: 85bfde5 (fix(compliance): alinha política de privacidade ao tratamento real de dados [SET-44])
Last reviewed: 2026-08-11
Superseded by: n/a

# Auditoria SET-44 — Política de Privacidade vs. tratamento real de dados

**Issue**: [SET-44](https://linear.app/setnar/issue/SET-44/corrigir-politica-de-privacidade-para-o-tratamento-real-de-dados) — **Done**, PR [#19](https://github.com/admin-setnar/setnar/pull/19) mergeada em `main` (commit `85bfde5`)
**Escopo desta auditoria**: inventariar o que o software realmente trata hoje e comparar com o texto publicado. **Não decide** bases legais, entidade controladora ou prazos de retenção — isso é SET-46 (retenção) e revisão jurídica (SET-45).
**Lacunas técnicas encontradas** viraram issues vinculadas: [SET-71](https://linear.app/setnar/issue/SET-71/minimizardefinir-retencao-do-payload-cru-em-billing-events) e [SET-72](https://linear.app/setnar/issue/SET-72/auditar-logs-de-erro-por-vazamento-de-pii-repasse-de-erro-cru-do), ambas ainda em Backlog.

## Como ler este documento

Cada afirmação de dado é rastreável a uma migration ou arquivo de código (path citado). Onde não há retenção implementada, isso é dito explicitamente — nenhum prazo foi inventado.

---

## 1. Mapa de dados real

### 1.1 Conta / Auth — `public.profiles`, `auth.users`
| Campo | Finalidade | Operador | Retenção real |
|---|---|---|---|
| `full_name`, `phone` (opcional), `tenant_id`, `terms_accepted_at`, `terms_version` | identidade da conta, prova de aceite dos termos, prefill de telefone no onboarding | Supabase (hosting/auth); leitura só do próprio titular via RLS `profiles_select_own` | enquanto a conta existir (`on delete cascade` de `auth.users`) |
| senha | — | hash gerido só pelo Supabase Auth, nunca em `profiles` | n/a |

Fonte: `supabase/migrations/20260728000000_create_profiles.sql:15-29`; `20260819000000_add_signup_phone_to_profiles.sql:6-15`.

**Página atual**: correta e completa para esta categoria.

### 1.2 Representative — perfil profissional (`public.representatives`)
| Campo | Finalidade | Operador | Retenção real |
|---|---|---|---|
| `phone` (obrigatório), `city`, `display_name`, `authorization_id`, `slug`, `status` | página comercial pública do representante | **público por design** via `representatives_select_public` quando `status='active'` + ativação `published`; escrita só via `register_representative()`/`update_representative_profile()` | indefinida, sem rotina de exclusão |

Fonte: `20260731000000_create_representative_domain.sql:158-184,257-267`; `20260818000000_require_professional_profile_phone.sql:26-56,58-253`.

**Página atual**: **não menciona.** Telefone comercial e cidade do representante são publicados no site — o titular (o representante) precisa saber disso na política.

### 1.3 Leads (visitante/potencial cliente)
| Campo | Finalidade | Operador | Retenção real |
|---|---|---|---|
| telefone, nome, cidade, e-mail (em `campos jsonb`), origem, referrer | captação de lead comercial para o representante | leitura só do representante dono (`leads_select_own`); escrita via `submit_lead()` | **indefinida** — nenhuma migration aplica TTL à tabela `leads` |
| `lead_submission_attempts.ip_hash` (artefato de rate limit, não o lead em si) | anti-abuso do formulário | — | 1 dia (`20260802000000:172-174`) |

Fonte: `20260731000000:299-326`; `20260801000000_add_lead_submission.sql:56-134`; `20260802000000_fix_submit_lead_rate_limit.sql:84-186`.

**Página atual**: **não menciona.** Esta é a categoria de dado pessoal de terceiro (não o titular da conta) mais visível ausente do texto — o formulário de lead roda na página pública do representante, sem qualquer aviso de privacidade próprio.

### 1.4 Analytics (`analytics_events`)
| Campo | Finalidade | Operador | Retenção real |
|---|---|---|---|
| `event_type` (visit/whatsapp_click), `referrer`, `ip_hash` (sha256 salgado com `ANALYTICS_IP_SALT`, salt deliberadamente distinto do de login para impedir correlação — ADR-054) | métricas de uso para o representante | escrita via `record_page_visit`/`record_whatsapp_click` | **sem purga implementada** — o próprio código documenta isso como decisão em aberto (AN7): `20260810000000_add_analytics_events.sql:169-181` |

**Página atual**: **não menciona** — nem o tracking em si, nem o hash de IP.

### 1.5 Rate limiting de login (`login_attempts`)
| Campo | Finalidade | Retenção declarada na página | Retenção real no código |
|---|---|---|---|
| `email_hash`, `ip_hash` (salt próprio, `LOGIN_ATTEMPT_SALT`), `attempted_at` | bloquear tentativas repetidas de login | **"15 minutos"** (`src/app/privacidade/page.tsx:104`) | **1 dia** — a purga foi trocada para `interval '1 day'` em `20260729000000_fix_login_attempts_cleanup.sql:57-59`; os 15 min só governam a janela de bloqueio de negócio, não a exclusão da linha |

**Página atual**: **factualmente incorreta**, independente de qualquer decisão jurídica futura. Esta é a única discrepância que já é um bug hoje, não uma lacuna de escopo.

### 1.6 Billing / Asaas
| Dado | Onde fica | Finalidade | Retenção real |
|---|---|---|---|
| `subscriptions` (status, `payment_method`, `amount_cents`, `external_customer_id`, `external_subscription_id`, ...) | banco próprio, sem RLS (só via RPCs) | registro financeiro da assinatura do representante | indefinida |
| `billing_events.payload` (jsonb) | banco próprio | **guarda o payload cru inteiro do webhook Asaas**, "para não perder nada" (comentário em `20260827000000_add_billing_webhook_events.sql:22-26`) | **sem purga** — nenhuma migration limpa esta tabela |
| CPF/CNPJ (`holderDocumentId`), e-mail, telefone, CEP, número de endereço do titular da assinatura | **não fica no nosso banco** — enviado ao Asaas em `createCustomer` (`asaas-payment-gateway.ts:73-93`, originado em `checkout.schema.ts:21-33`) | processar o pagamento | retenção é do Asaas, não nossa |

Por contraste, `billing_reconciliation_log` (mesmo sprint) **evita deliberadamente** guardar o payload cru, citando exatamente o risco de carregar e-mail/telefone do customer (`20260830000000_add_billing_reconciliation_log.sql:49-51`). `billing_events` não seguiu a mesma decisão — ver lacuna técnica #1 abaixo.

**Página atual**: **não menciona nada disto** — nem Asaas como operador, nem CPF/CNPJ, nem endereço, nem billing em geral. É a lacuna mais séria: billing é tratamento real e ativo (existe desde a série SET-24) e está completamente ausente do texto público.

### 1.7 Feedback qualitativo (`feedback_responses`)
Contexto, resposta e texto livre (até 140 caracteres) associados ao `representative_id` — inclui motivo de cancelamento e percepção de valor/PMF. Sem purga implementada. **Não mencionado na página.**

Fonte: `20260822000000_add_feedback_responses.sql:35-53`.

### 1.8 Logs operacionais e hosting
- Nenhum sub-processador de hosting (Vercel) é mencionado em lugar nenhum — nem a página, nem `.env.example`.
- Vários call sites (`supabase-lead-gateway.ts:63`, `auth-gateway-factory.ts:56-157`) repassam o objeto de erro cru do Supabase para `console.error`/`console.warn`. Não foi possível confirmar, só lendo os call sites, que nunca há fragmento de PII num log de erro (ex.: mensagem de constraint violation ecoando um valor). Tratado como lacuna técnica separada abaixo, não como afirmação factual no texto.

---

## 2. Discrepâncias a corrigir no texto (independem de decisão jurídica)

1. **Retenção de `login_attempts`**: página diz 15 min, código faz 1 dia. Corrigir para refletir o real.
2. **Categorias ausentes que já são tratamento ativo hoje**, sem depender de nenhuma decisão pendente:
   - Telefone/cidade do Representative (públicos na página comercial)
   - Leads (dado de terceiro capturado no formulário público)
   - Analytics/`ip_hash`
   - Billing/Asaas (incluindo CPF/CNPJ e endereço enviados ao operador de pagamento)
   - Feedback qualitativo
   - Vercel como sub-processador de hosting

## 3. Pontos que dependem de SET-46 (decisão de retenção)

Para `leads`, `analytics_events` e `billing_events.payload` não existe retenção implementada hoje. O texto final só pode afirmar um prazo se SET-46 aprovar um — até lá, a única frase factualmente correta é "sem prazo de retenção definido no momento" (ou equivalente), nunca um número inventado.

## 4. Lacunas técnicas — abertas como Issues vinculadas

1. **[SET-71](https://linear.app/setnar/issue/SET-71/minimizardefinir-retencao-do-payload-cru-em-billing-events)** — `billing_events.payload` guarda o payload cru do webhook Asaas sem minimização nem retenção, ao contrário da decisão tomada em `billing_reconciliation_log` no mesmo sprint (que evita isso deliberadamente pelo mesmo risco de PII).
2. **[SET-72](https://linear.app/setnar/issue/SET-72/auditar-logs-de-erro-por-vazamento-de-pii-repasse-de-erro-cru-do)** — auditoria de log scrubbing: confirmar se algum `console.error`/`console.warn` que repassa erro cru do Supabase pode vazar PII em texto livre (ex.: mensagem de constraint violation). Não é uma falha confirmada, é uma verificação pendente.

## 5. Status

Texto de `src/app/privacidade/page.tsx` atualizado nesta branch para refletir o inventário acima: corrigida a retenção de `login_attempts` (1 dia, não 15 min) e adicionadas as seções de perfil profissional, leads, analytics, billing/Asaas e feedback qualitativo. Nenhum prazo de retenção foi inventado para as categorias que dependem de SET-46; o texto declara explicitamente "ainda não temos um prazo de retenção aprovado" onde aplicável. O alerta de rascunho pendente de revisão jurídica foi mantido — nenhuma base legal foi decidida por engenharia.
