# Implementation Plans — Non-Normative

This folder holds **temporary working documents**: sprint plans, investigations,
audits, and design explorations. Nothing in this folder has permanent authority
over the product.

---

## Authority rule

Plans carry no authority. The governing rule — *documents do not authorize
implementation* — is defined once, in
[`docs/README.md`](../README.md#documents-do-not-authorize-implementation),
and applies here in full. It is not restated in this file, to keep a single
wording.

What that rule means specifically for plans:

A plan describes what someone *considered doing* at a moment in time. The
normative documents (`docs/README.md`, level 1–7) describe what SETNAR *is*.
When the two disagree, **the normative document wins and the plan is stale** —
there is no case in which a plan overrides a normative document.

**A plan is never the answer to "what does the product do today?"** For that,
read `PRODUCT.md` § *What Exists Today* and the ADRs in [`docs/adr/`](../adr/README.md).

---

## Required header

Every plan in this folder must carry, at the top:

```md
Status: Proposed | Approved | Implemented | Superseded | Archived
Authority: Non-normative
Code baseline: <commit, branch or date — or "Not identified">
Last reviewed: <date>
Superseded by: <document or ADR, when applicable>
```

`Code baseline` is what makes a plan auditable. A plan whose baseline is
unknown may have been written against a codebase that no longer exists — its
steps must be re-verified against the current code before any of them is
executed. Never invent a baseline.

---

## Current contents

| Plan | Status | Summary |
|---|---|---|
| [`QR_ANALYTICS_PLAN.md`](QR_ANALYTICS_PLAN.md) | Approved — partially implemented | QR1 + AN1–AN5 + AN7 shipped (ADR-049…054, ADR-086). **AN6 (showing statistics) is the only step not built** — analytics can be recorded, purged, but not yet shown to the representative. |
| [`SPRINT_E_PLAN.md`](SPRINT_E_PLAN.md) | Approved — partially implemented | E1, E2 and E4 shipped (ADR-063/064). E3, E5 and E6 open. Subscription is enforced on publication/public read, and the hub reflects public availability; activation remains manual. |
| [`COMMERCIAL_PAGE_CONTENT_PLAN.md`](COMMERCIAL_PAGE_CONTENT_PLAN.md) | Proposed — partially implemented, **open decisions** | CP3 and CP9 shipped; CP9 is an unapproved prototype. The iGreen brand-usage question (CP1) is unresolved. |
| [`BILLING_DECISIONS_PLAN.md`](BILLING_DECISIONS_PLAN.md) | Approved | All four billing decisions closed: gateway (Asaas), price (R$27.90/mo grandfathered for the first 30 customers), payment methods (card only at launch), and dunning/cancellation policy (suspend after Asaas exhausts retries, cancel at period end). §6 records extensibility requirements for SET-26/27/28/29 (payment methods and pricing must not be hardcoded) so future Pix/pricing additions are additive, not a rewrite. |
| [`archive/SPRINT_D_PLAN.md`](archive/SPRINT_D_PLAN.md) | Implemented — archived | D1–D5 shipped (ADR-037…047). Kept for the reasoning, not as pending work. |
| [`archive/AUDIT_SET-44_privacidade.md`](archive/AUDIT_SET-44_privacidade.md) | Implemented — archived | Privacy-page data inventory for SET-44 (PR #19, commit `85bfde5`). Kept for the reasoning. Spawned two open tech-debt issues: SET-71 (billing_events payload minimization) and SET-72 (PII log-scrubbing audit). |
| [`archive/AUDIT_SET-72_pii_log_scrubbing.md`](archive/AUDIT_SET-72_pii_log_scrubbing.md) | Implemented — archived | No active PII leak found, but raw-error logging was a latent risk in `leads`/`auth`/the five `safe-*-call.ts` wrappers/the Asaas webhook route. Fixed via `toSafeLogError` (ADR-084); SET-71 (billing_events retention) remains open, unrelated. |
| [`archive/AUDIT_SET-71_billing_events_payload.md`](archive/AUDIT_SET-71_billing_events_payload.md) | Implemented — archived | `billing_events.payload` minimized to only the fields already extracted/trusted, dropping the raw `.passthrough()` webhook body (ADR-085). Retention/purge timing intentionally left to SET-46, still open. |
| [`DATA_RETENTION_DECISIONS_PLAN.md`](DATA_RETENTION_DECISIONS_PLAN.md) | Approved — implemented | Pedro decided retention periods per category (SET-46): `leads` 24mo, `analytics_events` 12mo (AN7), `feedback_responses`/`subscriptions` tied to account lifecycle, `billing_events`/`billing_reconciliation_log` undefined (no PII to minimize by time). The `leads`/`analytics_events` purge job is implemented and deployed (SET-73, ADR-086) — `cron.job` confirms it scheduled and active. |
| [`MARKETING_MATERIALS_PLAN.md`](MARKETING_MATERIALS_PLAN.md) | Approved — implemented | SET-65: 21/21 materials ported to `src/modules/marketing-materials/`, live at `/app/paginas/marketing`. D1 (export pipeline) closed via a real POC — client-side capture (`html-to-image`), see ADR-090. |
| [`MVP_ANALYTICS_AUDIT.md`](MVP_ANALYTICS_AUDIT.md) | Proposed — investigative, no product decision made | Instrumentation/KPI readiness audit for the 15 MVP validation metrics. Verdict `PARTIALLY_READY_FOR_MVP_ANALYTICS`: no P0 gaps, but `whatsapp_click` and `leads` are parallel, uncorrelated events (not a real funnel), public page views don't exclude the representative's own self-visits, and `subscriptions` has no dedicated conversion/cancellation timestamp. Read-only investigation — nothing implemented. |
| [`ANALYTICS_DATA_LAYER_METABASE_READINESS.md`](ANALYTICS_DATA_LAYER_METABASE_READINESS.md) | Approved — D8–D12 closed by Pedro 2026-08-14 (D10 conditional on D9's LGPD review; D11 conditional on a security POC before any final migration) | Investigates a BI data layer for `STAGE_1_KPI_SPECIFICATION.md`'s KPIs: which are safe as direct queries vs. need a canonical SQL view (to keep the OR-not-funnel/`provider='asaas'`/`published` vs `unpublished` filters out of ad-hoc Metabase questions), a two-tier read-only Postgres role design (`bi_view_owner` bypassing RLS on curated `bi.*` views, `bi_readonly` with zero table access), PII minimization (`leads.telefone_e164`/`campos` never exposed), and Metabase Cloud vs. self-hosted. Adopting BI at all (D8) reverses SET-50/`PILOT_METRICS.md`'s explicit "sem BI" scope decision — extended, not erased. Nothing implemented yet — no role, schema, view or Metabase config created; D11's security POC is still pending. |
| [`STAGE_1_KPI_SPECIFICATION.md`](STAGE_1_KPI_SPECIFICATION.md) | Approved — D1–D7 closed by Pedro 2026-08-14 (D3/D5/D7 deliberately deferred past Stage 1) | Formalizes `MVP_ANALYTICS_AUDIT.md`'s findings into one canonical definition per Stage 1 KPI (formula/numerator/denominator/filters/known limitations), so no dashboard reinvents "Pagante" or "Representante ativo" differently. Key resolved definitions: `Activated Representative` = lifetime, published at least once (D1); `Result Rate` = with-result/activated, windowed off `published_at` (D2); `Paid Customer` requires `provider='asaas'`, not just `status='active'`; Founding Cohort Conversion is the Stage 1 headline paid-conversion metric (D6); churn stays D30/D60 retention-snapshot (D7). Nothing implemented — no view, RPC or Metabase config created. |
| [`AUDIT_MVP_LAUNCH.md`](AUDIT_MVP_LAUNCH.md) | Draft — awaiting Product Owner decision | Operational readiness audit for the MVP launch (Stage 1 of `ROADMAP.md`). Moved here from `docs/AUDIT_MVP_LAUNCH.md` on 2026-08-14 — basename unchanged, see the move table below. |
| [`AUDIT_PRE_LAUNCH_CONSISTENCY.md`](AUDIT_PRE_LAUNCH_CONSISTENCY.md) | Proposed — awaiting Product Owner decision | Code/docs consistency audit ahead of real paying customers. Reconciles this audit's Achado 2 with `AUDIT_MVP_LAUNCH.md`'s Achado 2 (they contradicted each other on `PRODUCT.md`'s billing claim — both are now correct once read together). 3 High-severity findings (`README.md` root's ADR count, `PRODUCT.md` § *MVP Goal*, `ROADMAP.md`) plus 7 Medium/Low findings across docs and a small code-redundancy sweep. No launch blocker found in code. |
| [`SET-84_DIVULGACAO_LEAN_PLAN.md`](SET-84_DIVULGACAO_LEAN_PLAN.md) | Approved — D1–D5 closed by Pedro 2026-08-26, nothing implemented yet | Lean-scope plan for SET-84 (Materiais → fluxo de Divulgação com atribuição de origem). No technical blocker — SET-65's `/app/paginas/marketing` already covers most of the "kit pronto" requirement; the one real gap is origin attribution (`analytics_events`/`leads` have no origin column, RPCs accept no `p_origin`). D3 approved with adjustment: `origin text` nullable + SQL check as an integrity barrier, but `ORIGIN_IDS` in TypeScript is the single canonical list, synced to SQL by a required test — no Postgres ENUM, no `origins` table. D4 changed from Pedro's product read: new `/app/divulgacao` route (own App Shell surface), not an extension of `/app/paginas/marketing` — composes existing modules, no new domain layer this round. D5 approved with adjustment: visits+leads listed side by side per origin with a derived (never stored) conversion rate, added as a section on the existing results screen, internally named "breakdown by origin" (never "channel analytics") since `origin` ≠ `channel`/`campaign`. §1.1 documents `origin` as current-visit entry attribution only, not a campaign/session model. |

`archive/` holds plans that are finished or superseded. Nothing is deleted:
the reasoning behind a decision is worth more than the plan that carried it.

---

## Where these files used to live

These four plans were moved out of `docs/` on 2026-08-05 so that they stop
looking like peers of the normative documents. **Filenames did not change** —
only the folder.

| Old path | New path |
|---|---|
| `docs/SPRINT_D_PLAN.md` | `docs/plans/archive/SPRINT_D_PLAN.md` |
| `docs/QR_ANALYTICS_PLAN.md` | `docs/plans/QR_ANALYTICS_PLAN.md` |
| `docs/SPRINT_E_PLAN.md` | `docs/plans/SPRINT_E_PLAN.md` |
| `docs/COMMERCIAL_PAGE_CONTENT_PLAN.md` | `docs/plans/COMMERCIAL_PAGE_CONTENT_PLAN.md` |

`docs/AUDIT_MVP_LAUNCH.md` moved the same way, later, on 2026-08-14:

| Old path | New path |
|---|---|
| `docs/AUDIT_MVP_LAUNCH.md` | `docs/plans/AUDIT_MVP_LAUNCH.md` |

Source comments, applied migrations, and ADRs written before these dates still
cite the old `docs/<NAME>.md` paths. Those references were deliberately left
untouched — applied migrations are never edited (see the migration rule in
`README.md`), and this was a documentation-only review. The basename is
unchanged, so every such reference resolves by filename.

---

## Adding a new plan

1. Write it here, not in `docs/`.
2. Give it the header above, with a real baseline.
3. When a step ships, write the ADR — the ADR is what becomes permanent,
   not the plan.
4. When the plan is done or abandoned, move it to `archive/` and set the
   status. Do not delete it.
