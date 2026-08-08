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
| [`QR_ANALYTICS_PLAN.md`](QR_ANALYTICS_PLAN.md) | Approved — partially implemented | QR1 + AN1–AN5 shipped (ADR-049…054). **AN6 (showing statistics) and AN7 (retention) are not built** — analytics is write-only today. |
| [`SPRINT_E_PLAN.md`](SPRINT_E_PLAN.md) | Approved — partially implemented | E1, E2 and E4 shipped (ADR-063/064). E3, E5 and E6 open. Subscription is enforced on publication/public read, and the hub reflects public availability; activation remains manual. |
| [`COMMERCIAL_PAGE_CONTENT_PLAN.md`](COMMERCIAL_PAGE_CONTENT_PLAN.md) | Proposed — partially implemented, **open decisions** | CP3 and CP9 shipped; CP9 is an unapproved prototype. The iGreen brand-usage question (CP1) is unresolved. |
| [`BILLING_DECISIONS_PLAN.md`](BILLING_DECISIONS_PLAN.md) | Approved | All four billing decisions closed: gateway (Asaas), price (R$27.90/mo grandfathered for the first 30 customers), payment methods (card only at launch), and dunning/cancellation policy (suspend after Asaas exhausts retries, cancel at period end). §6 records extensibility requirements for SET-26/27/28/29 (payment methods and pricing must not be hardcoded) so future Pix/pricing additions are additive, not a rewrite. |
| [`archive/SPRINT_D_PLAN.md`](archive/SPRINT_D_PLAN.md) | Implemented — archived | D1–D5 shipped (ADR-037…047). Kept for the reasoning, not as pending work. |

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

Source comments, applied migrations, and ADRs written before that date still
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
