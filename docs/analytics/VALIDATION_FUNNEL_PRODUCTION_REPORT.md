# SETNAR — Production Validation Funnel Report

**Investigation date:** 2026-08-25
**Environment investigated:** Production (`xiysyzauoifbcoviqblf.supabase.co`, `https://setnar.com`)
**Method:** Read-only. No `INSERT`/`UPDATE`/`DELETE`/DDL was executed against production at any point. Schema was investigated first, from actual applied migrations and a live OpenAPI introspection of the production PostgREST endpoint — nothing below assumes column names or status values without confirming them against the schema or the data.
**Access path used:** Supabase REST API (`/rest/v1/...`, `GET` only) and Supabase Auth Admin API (`/auth/v1/admin/users`, `GET` only), authenticated with the production `SUPABASE_SERVICE_ROLE_KEY` from `.env.production.local`. `psql`/`pg` were not available in this environment; PostgREST's `GET`-only surface was used specifically because it makes mutation structurally impossible, not just procedurally avoided.
**Raw data handling:** Full row data (including PII: names, phones, emails) was pulled into local script memory to compute this report, written once to a local scratch file, and never printed to this document or to the conversation transcript. This report contains only aggregates and anonymized aliases (`User_A`…`User_G`).

---

## 1. Executive Summary

- Production has **7 auth accounts** total. Two are excluded from the validation cohort with high confidence (one is the founder's own email, one is a `teste.com` test signup) — see §3. The remaining **5 external accounts** are the actual validation cohort.
- Of those 5: **all 5** completed onboarding (created a `representatives` row) and created at least one product page; **4 of 5** published at least one page; **4 of 5** received at least one recorded visit and at least one WhatsApp-click event; **2 of 5** produced at least one lead.
- The single largest proportional drop-off inside the in-product funnel is **click → lead (50% drop, 4→2)**.
- **The in-product funnel itself (account → representative → page → publish) is fast and clean**: median time from account creation to first publish is on the order of minutes, not days, and there are zero data-quality anomalies (no orphans, no duplicate activations, no impossible timestamps).
- **The traffic/engagement numbers cannot be taken at face value.** The `analytics_events` table has no visitor/session identity — it cannot distinguish the representative previewing their own page from an external visitor. A direct check of the `referrer` field for the 5-user cohort found **zero events with a referrer confirmable as external**; 36% of non-empty referrers point back to the same representative's own subdomain (self-navigation between their own product pages), and 64% of events have an empty referrer (ambiguous — consistent with either a direct/self-check or a real visitor arriving via WhatsApp's in-app browser, which is known to strip referrers).
- This is a **5-person cohort measured over roughly two weeks**, produced by founder-assisted WhatsApp outreach, not a self-serve funnel measured at scale. Every number below should be read as a signal to investigate, not as evidence of product-market fit.
- The 75+ people informally reported as prospected by WhatsApp are **not** in this database — that outreach was never instrumented, and is treated in §12 as a separate, external process with only an upper-bound conversion estimate.

---

## 2. Data Sources

Tables discovered live in production (`public` schema, via PostgREST OpenAPI introspection) and confirmed against the actual migration history in `supabase/migrations/`:

| Table | Function | PK | Relevant FKs | Timestamps | Status-like fields |
|---|---|---|---|---|---|
| `profiles` | 1:1 with `auth.users`; captures name, tenant, terms acceptance, a prefill phone | `id` (= `auth.users.id`) | — | `created_at`, `updated_at`, `terms_accepted_at` | — |
| `representatives` | The "licensee" entity — one per onboarded user | `id` | `profile_id → profiles.id` (unique), `company_id → companies.id` | `created_at`, `updated_at` | `status` (`active`/`suspended`) |
| `companies` | Catalog owner (only `iGreen` seeded) | `id` | — | `created_at`, `updated_at` | — |
| `products` | Fixed 7-slug catalog (`conexao-green`, `conexao-club`, `conexao-livre`, `conexao-placas`, `conexao-solar`, `green-seguros`, `telecom`) | `id` | `company_id → companies.id` | `created_at`, `updated_at` | — (no draft/retired concept exists) |
| `product_activations` | **This is the "Commercial Page" entity.** There is no separate `pages`/`commercial_pages` table — a page is one row here. | `id` | `representative_id`, `product_id` | `created_at` (= page created), `activated_at`, `published_at` (first publish only, never overwritten) | `status` (`draft`/`published`/`unpublished`) |
| `subscriptions` | Billing/entitlement gate for publishing | `id` | `representative_id` (unique) | `created_at`, `updated_at`, `current_period_end` | `status` (`active`/`trialing`/`past_due`/`suspended`/`canceled`) |
| `analytics_events` | Append-only visit/click log | `id` | `representative_id`, `product_id` | `created_at` | `event_type` (`visit`/`whatsapp_click` — only these two exist) |
| `leads` | Lead capture form submissions | `id` | `representative_id`, `product_id` (nullable) | `created_at` | — |
| `feedback_responses` | A single in-product feedback prompt, shown at first publication | `id` | `representative_id` | `shown_at`, `answered_at`, `dismissed_at`, `created_at` | `context` (`first_publication`), `response` |
| `billing_events`, `billing_reconciliation_log`, `login_attempts`, `lead_submission_attempts`, `lgpd_request_log` | Security/billing operational tables, not funnel-relevant | — | — | — | — |
| `auth.users` (Supabase Auth, not `public` schema) | Account creation timestamp, email | `id` | — | `created_at`, `last_sign_in_at`, `email_confirmed_at` | — |

**Data quality problems found:** none (see §11 for the checks run).

---

## 3. Cohort Definition

**A) Total raw accounts:** 7 (`auth.users` rows, all with a corresponding `profiles` and `representatives` row — no orphans).

**B) Total after exclusion:** 5.

**C) Exclusion rules proposed, applied to all 7 accounts (none excluded silently):**

| Account | Signal(s) found | Rule | Excluded? |
|---|---|---|---|
| `User_A` | Auth email is an **exact match** to the founder's own personal email on file (`pedrooswg@gmail.com`) | Exact email match to a known internal identity | **Yes** |
| `User_C` | Auth email domain is `teste.com`; representative slug, display name, and email local-part all match `/test\|teste\|qa\|demo\|sample/i` | Non-real email domain + multiple naming-pattern matches for test data | **Yes** |
| `User_B`, `User_D`, `User_E`, `User_F`, `User_G` | None of the above signals present; consumer email domains (`gmail.com`); no test/demo naming pattern | — | No |

**D) Confidence:**
- `User_A` exclusion: **HIGH** — this is an exact string match against a known identity, not a heuristic pattern.
- `User_C` exclusion: **HIGH** — four independent signals agree (domain, slug, display name, email local-part).
- Non-exclusion of the other 5: **MEDIUM** — there is no authoritative "is_internal"/"is_test" flag anywhere in the schema (no `role` column, no metadata field used for this, no `environment` marker). Absence of evidence is not proof these are all genuine external licensees; it only means no exclusion signal fired. This is flagged as a schema gap in §14.

**Note on the founder's account (`User_A`):** it is also the single most active account in the dataset (91 visits, 9 WhatsApp clicks, 1 lead, activity continuing through the day of this investigation, all 7 products activated and published within ~1.5 days of signup). That activity pattern (full-catalog activation, sustained daily use) is far more consistent with the founder's own working/demo account than with a licensee's organic usage, which independently supports the exclusion above.

All numbers from §4 onward use the **5-account eligible cohort** unless stated otherwise.

---

## 4. Measurement Model

| # | Stage | Classification | Definition / rule used |
|---|---|---|---|
| 1 | Conta criada | **DIRECTLY_MEASURABLE** | `auth.users.created_at` |
| 2 | Perfil/representative criado | **DIRECTLY_MEASURABLE** | `representatives.created_at`. In this schema, "profile criado" and "representative criado" are effectively the same measurable moment as "onboarding concluído" — see stage 3/4. |
| 3 | Onboarding iniciado | **NOT_MEASURABLE** | `register_representative()` is a single atomic RPC call (confirmed by reading its SQL body in `supabase/migrations/20260806000000_add_register_representative.sql` and its later revision). There is no partial/in-progress onboarding state persisted anywhere — a user who starts filling the onboarding form and abandons it before submitting leaves **zero trace** in the database. "Onboarding iniciado" as a distinct stage from "onboarding concluído" does not exist in this data model. |
| 4 | Onboarding concluído | **DIRECTLY_MEASURABLE** | `representatives.created_at` (same row/timestamp as stage 2 — the RPC creates `representatives` and, in the current function version, a `subscriptions` row with `status='trialing'` in the same transaction). |
| 5 | Primeira página criada/configurada | **DIRECTLY_MEASURABLE** | `min(product_activations.created_at)` per representative (written by `activate_product()`; row is born in `status='draft'`). |
| 6 | Primeira página publicada | **DIRECTLY_MEASURABLE** | `min(product_activations.published_at) where published_at is not null` per representative. Rule verified against `set_activation_status()`'s SQL: `published_at` is set via `coalesce(v_published_at, now())` **only** on the first `draft/unpublished → published` transition and is never overwritten or nulled afterward — so this timestamp is durably "first went live," even through later unpublish/republish cycles. |
| 7 | Primeira visita real à página publicada | **INFERABLE_WITH_CAVEATS** | `min(analytics_events.created_at) where event_type='visit'` per representative. Measurable as "a visit event was recorded," **not** measurable as "an external person visited" — see §9 (Etapa 6 finding: no visitor identity exists in this table). |
| 8 | Primeiro clique relevante | Same as WhatsApp click below (no other CTA type is instrumented) | — |
| 9 | Primeiro clique para WhatsApp | **INFERABLE_WITH_CAVEATS** | `min(analytics_events.created_at) where event_type='whatsapp_click'` per representative. Same self-vs-external caveat as visits. |
| 10 | Primeiro lead | **DIRECTLY_MEASURABLE (occurrence)** / **INFERABLE_WITH_CAVEATS (as "external interest")** | `min(leads.created_at)` per representative. The row's existence is a hard fact; whether it represents a genuine external prospect vs. the representative testing their own form is not distinguishable from the data (no submitter identity captured). |
| 11 | Usuário com atividade recorrente | **INFERABLE_WITH_CAVEATS** | Could be approximated as "events on ≥2 distinct calendar days," but with only 5 users and at most a handful of events each, this would not be a statistically meaningful pattern — reported descriptively per user in §6, not as a cohort metric. |
| 12 | Gerou valor real | **NOT_MEASURABLE** | No revenue/conversion-to-paid event exists yet: every `subscriptions.status` in the entire dataset is `trialing` (nobody has converted to a paid plan, and `billing_events`/`billing_reconciliation_log` are both empty). "Real value generated" cannot be measured from billing outcomes today. |

---

## 5. Funnel

**Cohort: 5 eligible accounts (`User_B`, `User_D`, `User_E`, `User_F`, `User_G`).**

| Stage | N | % of previous stage | % of accounts created | Lost (n) | Drop-off % |
|---|---:|---:|---:|---:|---:|
| Conta criada | 5 | — | 100% | — | — |
| Representative criado | 5 | 100% | 100% | 0 | 0% |
| Página criada (≥1 `product_activations` row) | 5 | 100% | 100% | 0 | 0% |
| Página publicada (≥1 `status='published'`) | 4 | 80% | 80% | 1 | 20% |
| Recebeu ≥1 evento de visita | 4 | 100% | 80% | 0 | 0% |
| Recebeu ≥1 clique WhatsApp | 4 | 100% | 80% | 0 | 0% |
| Gerou ≥1 lead | 2 | 50% | 40% | 2 | **50%** |

Read this table with §9 in mind: rows 5 and 6 ("recebeu visita" / "recebeu clique") measure that **an event was recorded**, not that an external person generated it — see the traffic-quality finding below. The register→publish portion of the funnel (rows 1–4) does not have that caveat; it is measured from unambiguous, single-purpose state transitions.

The one non-published account (`User_G`) registered on the same day as this investigation and has a page in `draft` — this reads as "still mid-flow," not as an abandoned drop-off (see §8).

---

## 6. User Activation Timelines

Aliases are assigned in order of account creation. No name, phone, email, or slug is included below.

**User_B**
- Conta criada: 2026-08-14 23:35 UTC
- Representative criado: 2026-08-14 23:36 UTC (< 1 min later)
- Primeira página criada: 2026-08-14 23:36 UTC
- Primeira publicação: 2026-08-14 23:37 UTC
- Ativações: 7 de 7 produtos, todas publicadas
- Primeira visita: 2026-08-14 23:38 UTC · Primeiro clique WhatsApp: 2026-08-14 23:38 UTC · Primeiro lead: 2026-08-14 23:39 UTC
- Última atividade observada: 2026-08-15 00:15 UTC
- **Estágio: LEAD_GENERATED**

**User_D**
- Conta criada: 2026-08-21 11:03 UTC
- Representative criado: 2026-08-21 11:04 UTC
- Primeira página criada: 2026-08-21 11:04 UTC
- Primeira publicação: 2026-08-21 11:04 UTC
- Ativações: 1 de 7 produtos, publicada
- Primeira visita: 2026-08-21 11:06 UTC · Primeiro clique WhatsApp: 2026-08-21 11:20 UTC · Lead: nenhum
- Última atividade observada: 2026-08-21 11:20 UTC
- **Estágio: WHATSAPP_ENGAGED**

**User_E**
- Conta criada: 2026-08-22 15:12 UTC
- Representative criado: 2026-08-22 15:14 UTC
- Primeira página criada: 2026-08-22 15:15 UTC
- Primeira publicação: 2026-08-22 15:16 UTC
- Ativações: 4 de 7 produtos, todas publicadas
- Primeira visita: 2026-08-22 15:17 UTC · Primeiro clique WhatsApp: 2026-08-22 15:17 UTC · Primeiro lead: 2026-08-22 15:22 UTC
- Última atividade observada: 2026-08-22 19:44 UTC
- **Estágio: LEAD_GENERATED**

**User_F**
- Conta criada: 2026-08-22 15:31 UTC
- Representative criado: 2026-08-22 15:37 UTC (~6 min depois — o maior intervalo conta→onboarding do grupo elegível)
- Primeira página criada: 2026-08-22 15:37 UTC
- Primeira publicação: 2026-08-22 15:38 UTC
- Ativações: 7 de 7 produtos, todas publicadas
- Primeira visita: 2026-08-22 16:58 UTC (~80 min após publicar) · Primeiro clique WhatsApp: 2026-08-22 16:59 UTC · Lead: nenhum
- Última atividade observada: 2026-08-23 02:14 UTC (atividade se estende por >10h, o padrão mais "espalhado no tempo" do grupo)
- **Estágio: WHATSAPP_ENGAGED**

**User_G**
- Conta criada: 2026-08-25 15:43 UTC (mesmo dia desta investigação)
- Representative criado: 2026-08-25 16:26 UTC (~43 min depois)
- Primeira página criada: 2026-08-25 16:28 UTC
- Publicação: ainda não ocorreu (activation em `draft`)
- Visita / clique / lead: nenhum ainda
- **Estágio: PAGE_CREATED_DRAFT** — em andamento, não necessariamente abandono (ver §8)

*(User_A e User_C foram excluídos da coorte — ver §3 — e não têm timeline reportada aqui.)*

---

## 7. Time to Activation

**Sample size warning: n=4 or n=5, and for the lead-timing metric n=2. None of this is a robust statistic — medians/means with a sample this small can flip entirely with one more data point. Reported because it was requested, not as a claim of precision.**

| Metric | n | Median | Mean | Min | Max |
|---|---:|---:|---:|---:|---:|
| Conta criada → Representative criado | 5 | 2.4 min | 10.8 min | 0.6 min | 43.8 min |
| Conta criada → Primeira página criada | 5 | 2.4 min | 11.4 min | 0.6 min | 45.6 min |
| Conta criada → Primeira publicação | 4 | 3.0 min | 3.0 min | 0.6 min | 6.0 min |
| Publicação → Primeira visita | 4 | 1.2 min | 21.0 min | 0.6 min | 80.4 min |
| Publicação → Primeiro clique WhatsApp | 4 | 9.0 min | 25.2 min | 1.2 min | 81.6 min |
| Publicação → Primeiro lead | 2 | 4.2 min | 4.2 min | 1.8 min | 6.6 min |

**Reading this critically, not just reporting it:** every step from account creation to first publish happens within minutes for essentially the whole cohort. That is unusually fast for a self-serve product (reading instructions, filling a form, deciding on products, publishing) and is a strong **signal — not proof** — that these sessions were founder-assisted (e.g. done live over a call/WhatsApp) rather than the user working through onboarding alone on their own time. If true, this funnel is currently measuring "does a guided setup produce a working page," not "can a licensee self-activate unassisted" — those are different questions, and only the product data can't tell you which; only the founder's own memory of how each of these 5 sessions actually happened can confirm or rule this out.

---

## 8. Drop-off Analysis

| Group | N (of 5) | Evidence |
|---|---:|---|
| A) Criou conta e não fez mais nada | **0** | Every eligible account has ≥1 `product_activations` row. |
| B) Começou onboarding e parou | **NOT_MEASURABLE** | Onboarding is atomic (§4, stage 3) — a stopped/abandoned onboarding attempt leaves no row anywhere. |
| C) Criou página mas não publicou | **1** (`User_G`) | 1 `product_activations` row, `status='draft'`, no `published_at`. Registered the same day as this report — plausibly still in progress, not necessarily stalled. |
| D) Publicou mas não recebeu tráfego | **0** | All 4 published accounts have ≥1 `visit` event. |
| E) Recebeu tráfego mas nenhum clique | **0** | All 4 accounts with a visit event also have ≥1 `whatsapp_click` event. |
| F) Recebeu clique mas nenhum lead | **2** (`User_D`, `User_F`) | Both have ≥1 `whatsapp_click` and 0 rows in `leads`. |

The **largest, most concrete gap is group F**: half of the users who published, got visited, and got a WhatsApp click did not produce a lead. With n=2 this is not enough to diagnose *why* (page content? WhatsApp conversation didn't convert to the lead form? the click itself was self-testing, not a real prospect? too early to tell — one of the two, `User_D`, was only observed for ~17 minutes of activity total).

---

## 9. Engagement / Traffic Analysis

**This is the most important critical section of this report — do not skip it when acting on §5's numbers.**

`analytics_events` (confirmed from its migration SQL, `20260810000000_add_analytics_events.sql` and `20260811000000_add_analytics_write_functions.sql`) captures, per event: `representative_id` (the **page owner**, not the visitor), `product_id`, `event_type`, `referrer`, `ip_hash`, `created_at`. **There is no visitor/session/user identifier of any kind.** The functions that write these rows (`record_page_visit`, `record_whatsapp_click`) are called by anyone loading the public page — including the page's own owner previewing or testing it — and the row is indistinguishable from a real visitor's row once written.

Checked explicitly, as instructed, rather than assumed:

- **`user_id`**: not present on this table by design (visitors are anonymous by product design).
- **`session_id`**: does not exist.
- **`ip_hash`**: exists, but is a one-way hash with no stored raw IP to compare against — there is no known "owner's own IP" on file to match against it, so it cannot be used to positively identify or exclude self-visits either.
- **`user agent`**: received by the write RPCs (used only for a bot-filter substring match) but **not stored** in the table — not queryable after the fact.
- **UTM parameters**: not captured anywhere in the schema.
- **`referrer`**: the one usable signal. Checked directly against the 5-account cohort's 33 recorded events:

| Referrer category | Count | % |
|---|---:|---:|
| Empty/no referrer | 21 | 64% |
| Points to the **same representative's own** other product page (self-navigation) | 12 | 36% |
| Points to any other, external source (search, social, WhatsApp web, ad, etc.) | **0** | **0%** |

**Zero of the 33 recorded visit/click events in the eligible cohort have a referrer that can be positively identified as external.** The 64% with an empty referrer are ambiguous by nature — an empty referrer is equally consistent with a representative reloading their own page to check it, and with a real visitor opening a link inside WhatsApp's in-app browser (which strips the `Referer` header as a matter of privacy policy). This is not a claim that all traffic is fake; it is a statement that **the current instrumentation provides no positive evidence that any of it is external**, which is a materially different, weaker claim than "X external visits happened."

**Explicit conclusion, as instructed:** *Page views (and WhatsApp clicks) cannot be considered confirmed external traffic with the instrumentation currently in place.* The counts in §5's rows 5–6 should be read as "an event was recorded," full stop.

---

## 10. Lead Generation Analysis

3 leads exist in production total; 2 belong to the eligible cohort (`User_B`, `User_E`), 1 belongs to the excluded founder account (`User_A`).

For the 2 eligible leads:
- Both occurred within minutes of the representative's first publish (4.2 min median from publish to first lead — see §7).
- `leads` has no submitter identity either (same gap as §9): a lead row cannot be distinguished from the representative testing their own capture form versus a genuine external prospect purely from this data.
- `leads.campos` (the submitted form fields) was deliberately **not** read into this report — it is exactly the personal-data field the privacy instruction asked to avoid exposing, and its content is irrelevant to a count-based funnel report.

**This cannot be scored as "2 real prospects converted."** It can be scored as "2 of 5 users have a `leads` row on file" — a hard fact — with the same self-test ambiguity as the rest of §9 layered on top.

---

## 11. Data Quality Findings

All of the following checks were run against full production data (not samples) for every table in scope. **Result: zero anomalies found.**

- `representatives` with no matching `profiles` row: 0
- `profiles` with no matching `representatives` row: not applicable as an anomaly — `representatives` is created later in the flow by design (register step), so a profile without a representative is an expected, normal state (someone who signed up and hasn't finished onboarding), not a data problem.
- `product_activations` referencing a non-existent `representative_id`: 0
- `analytics_events` referencing a non-existent `representative_id`: 0
- `leads` referencing a non-existent `representative_id`: 0
- Duplicate `(representative_id, product_id)` pairs in `product_activations`: 0 (consistent with the `unique` constraint confirmed in the schema)
- `product_activations` with `status='published'` and `published_at IS NULL`: 0 (consistent with `set_activation_status()`'s logic, which always stamps `published_at` on the transition to `published`)
- `leads.created_at` earlier than the corresponding activation's `published_at`: 0
- `leads` referencing an activation that was never published: 0
- Timestamps earlier than `account_created_at` for any downstream event (activation/publish/visit/click/lead): 0
- `analytics_events.event_type` values found: exactly `{visit, whatsapp_click}` — matches the `CHECK` constraint, no unexpected values.
- `product_activations.status` values found: `{draft, published}` — `unpublished` exists as a valid state in the schema but was never observed in production data (nobody has unpublished a page yet).
- `subscriptions.status` values found: `{trialing}` only — nobody in production has converted to `active` (paid), and nobody has lapsed to `past_due`/`suspended`/`canceled` yet.
- `representatives.status` values found: `{active}` only — nobody has been suspended.

The absence of anomalies is itself informative: the write paths (`register_representative`, `activate_product`, `set_activation_status`, `record_page_visit`, `record_whatsapp_click`, `submit_lead`) appear to be enforcing their invariants correctly in production, for the data volume seen so far.

---

## 12. What We Cannot Know Yet

Explicitly required by the brief — this is the honest limit of what this database can answer, separated into what's out of the product's own instrumentation and what's an in-product measurement gap.

**Entirely outside the product — this data was never captured anywhere in this database, and asking the funnel to explain it is asking the wrong system:**
- Quantas pessoas foram efetivamente prospectadas por WhatsApp (the informal "75+" figure — this is a manual, external number and is **not derivable** from account count; see §13 for why 3-actual-registrations ≠ 4% of anything precise).
- Quantas responderam à abordagem, quantas aceitaram conhecer o produto, quantas assistiram a um vídeo/apresentação, quantas clicaram no link que o fundador enviou.
- Quantas chegaram à landing page **vindas especificamente da prospecção** (there is no campaign/UTM tracking anywhere in the schema to attribute a signup or a visit to a specific outreach message).
- Motivo de rejeição de quem foi abordado e não se cadastrou.
- Qualquer follow-up comercial feito fora da plataforma (ligações, novas mensagens, negociação).

None of the above should be estimated or backed into from the 5-7 accounts in this database — doing so would fabricate a metric this system cannot support.

**In-product gaps — measurable in principle, but not with today's instrumentation:**
- Se um evento de `visit`/`whatsapp_click`/`lead` foi gerado pelo próprio representante (auto-teste) ou por um visitante externo real (§9 — the single biggest gap affecting this report's confidence).
- Onboarding abandonado antes de `register_representative` ser chamado com sucesso (§4, stage 3) — completely invisible today.
- Qualquer navegação/comportamento do visitante que não termine em `visit`/`whatsapp_click`/`lead` (time on page, scroll, which section was seen, bounce).
- Origem de campanha (qual mensagem/canal específico gerou qual cadastro ou visita) — no UTM/campaign concept exists in the schema at all yet.
- Se um usuário chegou a ver algum material de divulgação além da própria página (posts, stories, grupos de WhatsApp) — completely outside this database.

---

## 13. Current Validation Interpretation

- With **n=5** eligible accounts, no ratio in this report should be read as a stable rate — it is 5 data points, not a sample from which to project a population rate. A single additional user converting or failing to convert would move every percentage in §5 by 20 points.
- **Differentiating the type of gap observed** (per the brief's explicit instruction not to jump straight to "build a feature"):
  - **Not** an acquisition problem in the in-product sense — every account that signed up did complete onboarding and create a page (100% at both steps). Acquisition, to the extent it's a problem, lives entirely in the off-platform WhatsApp prospecting funnel (§12), which this database cannot see.
  - **Not** clearly an onboarding-friction problem — the in-product path from signup to publish is fast (§7) and produced zero abandoned-but-registered accounts (§8, group A). The two people who did respond to the in-app feedback prompt both rated it "easy" (2 of 4 who were shown it; the other 2 haven't answered). That's a thin signal, not proof, but it points away from onboarding friction as the dominant issue.
  - **Possibly** a divulgation/traffic-generation problem, or possibly not a problem at all yet — **this genuinely cannot be told apart from a measurement problem** right now, because §9 shows zero confirmed-external traffic and no way to confirm otherwise. Low traffic could mean licensees aren't sharing their page, or it could mean they are sharing it and the instrumentation simply can't see the difference between that and their own self-checks.
  - **Possibly** a page-conversion problem for the click→lead step (§8, group F, 50% of engaged users) — but n=2 is far too small to diagnose whether that's the page content, the WhatsApp conversation not converting, or self-testing muddying the numbers.
  - **Definitely** a data-gap problem for anything involving "did an external person do X" — this is the dominant theme of this whole report.
- **Do not read this report as evidence toward or against product-market fit.** The brief is explicit about this and the data supports the caution: 5 people, all apparently onboarded with heavy founder involvement, over roughly two weeks, is a feasibility/mechanics check ("does the pipeline work end-to-end without breaking"), not a market signal.

---

## 14. Recommended Instrumentation

Framed as measurement gaps to close, not features to build — and each tied to a specific finding above rather than a general wishlist:

1. **Distinguish owner self-traffic from visitor traffic** (closes §9, the report's biggest gap). The lightest-weight version: when the authenticated owner loads their own published page, suppress the `record_page_visit`/`record_whatsapp_click` calls (or tag them distinctly) instead of writing an indistinguishable row. This alone would make §5's traffic/click rows trustworthy.
2. **Capture minimal campaign attribution** on the public page URL (closes §12's landing-page-from-prospecting gap) — e.g. an optional `?src=` param the founder appends to links sent manually, stored on the `visit`/`lead` row. Not a general analytics platform — one parameter, sourced by the founder himself, would let a future report separate "came from my WhatsApp message" from everything else.
3. **A formal internal/test-account marker** (closes §3's confidence gap) — a boolean or role column on `profiles`/`representatives`, or even a documented list maintained outside the DB, so cohort exclusion in future reports doesn't depend on heuristic email-domain/name pattern-matching.
4. **A partial-onboarding signal**, if abandonment before `register_representative` ever becomes a question worth answering — today it is entirely invisible (§4, stage 3; §8, group B). Not recommended as urgent given n=5 shows zero evidence this is currently a problem worth solving.

---

## 15. SQL Queries

All queries are `SELECT`-only, PostgreSQL/Supabase-compatible, and were the basis (translated to REST `GET` calls, since no SQL client was available in this environment — see the header) for every number in this report. Run from the Supabase SQL Editor (or any read-only role) against the production project. None of these mutate state.

```sql
-- 1. Total de contas elegíveis (exclui founder e domínio de teste — ajuste os
--    e-mails/heurísticas conforme a Etapa 3 antes de reusar).
select count(*) as eligible_accounts
from auth.users u
where u.email not ilike '%@teste.com'
  and u.email <> 'pedrooswg@gmail.com';

-- 2. Total de representatives (por conta elegível)
select count(*) as representatives_total
from public.representatives r
join auth.users u on u.id = r.profile_id
where u.email not ilike '%@teste.com'
  and u.email <> 'pedrooswg@gmail.com';

-- 3. Representatives com página criada (>=1 activation, qualquer status)
select count(distinct pa.representative_id) as with_page_created
from public.product_activations pa
join public.representatives r on r.id = pa.representative_id
join auth.users u on u.id = r.profile_id
where u.email not ilike '%@teste.com'
  and u.email <> 'pedrooswg@gmail.com';

-- 4. Representatives com página publicada (>=1 activation published)
select count(distinct pa.representative_id) as with_page_published
from public.product_activations pa
join public.representatives r on r.id = pa.representative_id
join auth.users u on u.id = r.profile_id
where pa.status = 'published'
  and u.email not ilike '%@teste.com'
  and u.email <> 'pedrooswg@gmail.com';

-- 5. Representatives com >=1 evento de visita registrado
select count(distinct ae.representative_id) as with_visit_event
from public.analytics_events ae
join public.representatives r on r.id = ae.representative_id
join auth.users u on u.id = r.profile_id
where ae.event_type = 'visit'
  and u.email not ilike '%@teste.com'
  and u.email <> 'pedrooswg@gmail.com';

-- 6. Representatives com >=1 clique WhatsApp registrado
select count(distinct ae.representative_id) as with_whatsapp_click
from public.analytics_events ae
join public.representatives r on r.id = ae.representative_id
join auth.users u on u.id = r.profile_id
where ae.event_type = 'whatsapp_click'
  and u.email not ilike '%@teste.com'
  and u.email <> 'pedrooswg@gmail.com';

-- 7. Representatives com >=1 lead
select count(distinct l.representative_id) as with_lead
from public.leads l
join public.representatives r on r.id = l.representative_id
join auth.users u on u.id = r.profile_id
where u.email not ilike '%@teste.com'
  and u.email <> 'pedrooswg@gmail.com';

-- 8. Timeline individual (por representative_id — substitua o filtro)
select
  u.created_at                        as account_created_at,
  r.created_at                        as representative_created_at,
  min(pa.created_at)                  as first_page_created_at,
  min(pa.published_at)                as first_published_at,
  min(ae.created_at) filter (where ae.event_type = 'visit')           as first_visit_at,
  min(ae.created_at) filter (where ae.event_type = 'whatsapp_click')  as first_whatsapp_click_at,
  min(l.created_at)                   as first_lead_at
from public.representatives r
join auth.users u on u.id = r.profile_id
left join public.product_activations pa on pa.representative_id = r.id
left join public.analytics_events ae on ae.representative_id = r.id
left join public.leads l on l.representative_id = r.id
where r.id = :representative_id
group by u.created_at, r.created_at;

-- 9. Tempos até ativação (em minutos), por representative, coorte elegível
select
  r.id as representative_id,
  extract(epoch from (r.created_at - u.created_at)) / 60.0            as min_account_to_representative,
  extract(epoch from (min(pa.created_at) - u.created_at)) / 60.0      as min_account_to_first_page,
  extract(epoch from (min(pa.published_at) - u.created_at)) / 60.0    as min_account_to_first_publish,
  extract(epoch from (
    min(ae.created_at) filter (where ae.event_type = 'visit') - min(pa.published_at)
  )) / 60.0                                                            as min_publish_to_first_visit,
  extract(epoch from (
    min(ae.created_at) filter (where ae.event_type = 'whatsapp_click') - min(pa.published_at)
  )) / 60.0                                                            as min_publish_to_first_click,
  extract(epoch from (min(l.created_at) - min(pa.published_at))) / 60.0 as min_publish_to_first_lead
from public.representatives r
join auth.users u on u.id = r.profile_id
left join public.product_activations pa on pa.representative_id = r.id
left join public.analytics_events ae on ae.representative_id = r.id
left join public.leads l on l.representative_id = r.id
where u.email not ilike '%@teste.com'
  and u.email <> 'pedrooswg@gmail.com'
group by r.id;

-- 10. Drop-offs por grupo (coorte elegível)
with cohort as (
  select r.id as representative_id, r.created_at as rep_created_at
  from public.representatives r
  join auth.users u on u.id = r.profile_id
  where u.email not ilike '%@teste.com'
    and u.email <> 'pedrooswg@gmail.com'
),
agg as (
  select
    c.representative_id,
    count(pa.id) as activations,
    bool_or(pa.status = 'published') as has_published,
    count(*) filter (where ae.event_type = 'visit') as visits,
    count(*) filter (where ae.event_type = 'whatsapp_click') as clicks,
    count(l.id) as leads
  from cohort c
  left join public.product_activations pa on pa.representative_id = c.representative_id
  left join public.analytics_events ae on ae.representative_id = c.representative_id
  left join public.leads l on l.representative_id = c.representative_id
  group by c.representative_id
)
select
  count(*) filter (where activations = 0)                          as a_account_no_further_action,
  count(*) filter (where activations > 0 and not has_published)     as c_page_created_not_published,
  count(*) filter (where has_published and visits = 0)              as d_published_no_traffic,
  count(*) filter (where visits > 0 and clicks = 0)                 as e_traffic_no_click,
  count(*) filter (where clicks > 0 and leads = 0)                  as f_click_no_lead
from agg;

-- 11. Data quality — activations publicadas sem published_at (deveria ser sempre 0)
select id, representative_id, status, published_at
from public.product_activations
where status = 'published' and published_at is null;

-- 12. Data quality — leads anteriores à publicação da respectiva activation
select l.id as lead_id, l.created_at as lead_created_at, pa.published_at
from public.leads l
join public.product_activations pa
  on pa.representative_id = l.representative_id and pa.product_id = l.product_id
where pa.published_at is not null
  and l.created_at < pa.published_at;

-- 13. Distinct status/event_type values realmente em uso (não assuma — confira)
select 'representatives.status' as col, status as value, count(*) from public.representatives group by status
union all
select 'product_activations.status', status, count(*) from public.product_activations group by status
union all
select 'subscriptions.status', status, count(*) from public.subscriptions group by status
union all
select 'analytics_events.event_type', event_type, count(*) from public.analytics_events group by event_type;

-- 14. Traffic quality — referrer classificado (self-navigation vs. vazio vs. externo)
--     Rode por representative_id para checar contra o próprio slug do representante.
select
  ae.id,
  ae.created_at,
  ae.event_type,
  ae.referrer,
  case
    when ae.referrer is null or ae.referrer = '' then 'empty'
    when ae.referrer ilike '%://' || r.slug || '.%' then 'self_navigation'
    else 'other_external'
  end as referrer_class
from public.analytics_events ae
join public.representatives r on r.id = ae.representative_id
join auth.users u on u.id = r.profile_id
where u.email not ilike '%@teste.com'
  and u.email <> 'pedrooswg@gmail.com';
```

---

## 16. Final Verdict

```
CURRENT_PRODUCT_ACTIVATION: INSUFFICIENT_DATA
  (n=5. In-product activation itself, account→publish, looks strong at this
  scale — 80% published, fast, zero abandonment. But downstream "activation
  of value" — traffic and leads — has zero confirmed-external evidence (§9),
  so there isn't enough trustworthy signal yet to call it LOW/MEDIUM/HIGH.)

FUNNEL_CONFIDENCE: MEDIUM
  (HIGH for account→representative→page→publish: clean, directly measurable,
  zero data-quality anomalies. LOW for visit/click/lead-as-external-interest:
  no visitor identity exists to confirm any of it. Averages to MEDIUM.)

BIGGEST_OBSERVED_DROPOFF: WhatsApp click → Lead (50% drop, 4→2; the largest
  proportional loss at any measured transition in the eligible cohort)

USERS_REGISTERED: 5 (eligible cohort; 7 raw accounts, 2 excluded — see §3)

USERS_PUBLISHED: 4

USERS_WITH_EXTERNAL_TRAFFIC: UNKNOWN
  (4 users have >=1 recorded visit event; 0 of those events carry a referrer
  confirmable as external — see §9. "UNKNOWN," not "0," because absence of a
  confirming referrer does not prove absence of a real visitor.)

USERS_WITH_WHATSAPP_ENGAGEMENT: UNKNOWN
  (4 users have >=1 recorded whatsapp_click event; same self-vs-external
  ambiguity as traffic applies — a click event does not know who clicked it.)

USERS_WITH_LEADS: 2
  (Row existence is a hard fact. Whether either lead represents a genuine
  external prospect vs. a self-test submission cannot be determined from
  this data — both occurred within minutes of the respective first publish.)

MAIN_DATA_GAP: analytics_events and leads capture zero visitor/session
  identity of any kind, so the platform currently cannot tell its own
  founder/representative previewing a page apart from a genuine external
  visitor or lead. This affects every "engagement" number in this report.

NEXT_MOST_IMPORTANT_ACTION: Before drawing any further conclusion from
  traffic or lead counts, close the self-vs-external measurement gap (§14,
  item 1) — it is cheap relative to the alternative, which is continuing to
  report numbers that cannot currently be trusted at face value. This is an
  instrumentation fix, not a new feature, and it is a prerequisite for any
  future version of this report to say something stronger than "a page got
  a lead" or "a page got a visit."
```
