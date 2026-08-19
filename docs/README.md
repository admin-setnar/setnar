# SETNAR Documentation — Authority Map

This file exists to answer one question before any other: **which document
decides this?**

Read it first. It is an index and a hierarchy, not a source of truth about the
product itself — it holds no product decisions of its own.

---

## Normative hierarchy

Authority runs top to bottom. **Where two documents conflict, the higher one
wins and the lower one is a defect to be fixed** — never the other way around.

| # | Document | Decides | Does **not** decide |
|---|---|---|---|
| 1 | [`PRODUCT_CONSTITUTION.md`](PRODUCT_CONSTITUTION.md) | Identity, purpose, permanent principles, strategic limits, the professional ↔ authorizing organization ↔ customer relationship | Features, scope, schemas, sequencing, anything that can change per sprint |
| 2 | [`PRODUCT.md`](PRODUCT.md) | Product & business strategy, audience, problem, value proposition, positioning, **public narrative and its limits**, business model, current scope, what exists today | Implementation sequencing, domain entities, technical structure |
| 3 | [`ROADMAP.md`](ROADMAP.md) | Stage sequencing, hypotheses, entry/exit conditions, expected evidence, candidate capabilities per stage | Company identity, new domain entities, public promises |
| 4 | [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) | Ubiquitous language, entities, aggregates, invariants, relationships, states, **and the implementation status of each** | Technical structure, frameworks, storage, UI |
| 5 | [`ARCHITECTURE.md`](ARCHITECTURE.md) | Modules, layers, boundaries, dependencies, integration rules, tenant isolation, structural and security architecture | Day-to-day code style, review practice, naming — those are level 7 |
| 6 | [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Visual identity, interface principles, accessibility, tokens, motion, surface-specific experience rules | Product scope, public claims (those are level 2) |
| 7 | [`ENGINEERING_GUIDELINES.md`](ENGINEERING_GUIDELINES.md) | Everyday engineering practice: quality, tests, error handling, observability, review, naming, operational security | Architecture (level 5), which is structural, not daily |

Non-normative material lives in [`plans/`](plans/README.md) and carries no
authority at any level.

---

## Which document wins

**The lower number wins.** A level-2 statement overrides a level-5 statement on the same question, and the lower-authority document is then a defect to be corrected — never a reason to reinterpret the higher one.

Three tie-breakers that the table alone does not settle:

1. **On "does this exist?", `PRODUCT.md` § *What Exists Today* wins over every other document, including this one.** It is the only section verified against code with a recorded baseline.
2. **On "why is the code like this?", the ADRs win over `ARCHITECTURE.md`.** ADRs record decisions actually taken; `ARCHITECTURE.md` records the intended general shape, and a specific decision beats a general rule.
3. **Plans never win against anything.** A plan that contradicts a normative document is stale, without exception.

If two documents at the same level conflict, that is a defect with no resolution procedure — escalate to the Product Owner rather than picking one.

---

## Reading order

Read in this order. Each document is only interpretable in the light of the one above it.

1. `README.md` (repository root) — what this is, and where the rest lives
2. [`PRODUCT_CONSTITUTION.md`](PRODUCT_CONSTITUTION.md) — identity and permanent principles
3. [`PRODUCT.md`](PRODUCT.md) — strategy, and **What Exists Today**
4. [`ROADMAP.md`](ROADMAP.md) — sequencing, and what is only a candidate
5. [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) — language and modelling (**§ 3.1 first**)
6. [ADRs, in `docs/adr/`](adr/README.md) — why the code is as it is
7. [`ARCHITECTURE.md`](ARCHITECTURE.md) — structure and boundaries
8. [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — experience, per surface
9. [`ENGINEERING_GUIDELINES.md`](ENGINEERING_GUIDELINES.md) — everyday practice
10. **An approved execution plan** — only now may code be written

Two things about this order are deliberate:

- **`PRODUCT.md` before `ROADMAP.md`**, so that what exists is known before what is planned. Reversing them is how a roadmap item gets mistaken for a description of the product.
- **The ADRs before `ARCHITECTURE.md`**, because the ADRs record what was actually decided, including decisions that qualify the general rules. `ARCHITECTURE.md` describes the intended shape; the ADRs describe the shape that exists.

Reaching the end of this list does not authorize implementation — it makes you ready to be given work.

---

## Where ADRs live

**Architecture Decision Records live in [`docs/adr/`](adr/README.md), one file per
decision, numbered `ADR-001` onward.** Start at `docs/adr/README.md` for the
index — number, title, the normative document each decision belongs to, and
any correction/sequencing relationship to another ADR.

**Migrated from the repository root `README.md` on 2026-08-05**, by this
certification audit. That file held all 63 decisions in one 232 KB section,
which had real, growing costs — no index, diff noise on every new entry, a
newcomer's "how do I run this?" answered by the same document as an
auditor's "why was this decided?" The migration was mechanical: a script
split the log by heading and the result was verified character-for-character
against the original — no ADR was rewritten, reworded, renumbered, or
reordered. Root `README.md` now keeps setup/onboarding content and points
here.

An ADR is required when a decision is permanent, structural, hard to reverse,
cross-cutting, or relevant to more than one module. Small or stylistic
choices do not get an ADR.

Each ADR states: context, problem, alternatives considered, decision,
positive consequences, negative consequences, and its relationship to the
normative documents above. **Status and date are not part of the existing 63**
(see `docs/adr/README.md` § *Outstanding gaps*) but are required in every ADR
written from now on.

**No new ADR may be written into the root `README.md`.** Every ADR from
`ADR-064` onward is a new file in `docs/adr/`, following the same convention.
A decision log split across two locations is worse than either whole state —
this is now settled, not a recommendation.

---

## Documents do not authorize implementation

> **Audit, investigation, proposal, design-exploration and plan documents do not
> authorize implementation.** Before any code changes, an approved execution plan
> must exist, with: limited scope, an identified code baseline, acceptance
> criteria, the files it touches, risks, tests, and an explicit list of what is
> out of scope.

**This is the canonical statement of the rule.** It applies to every reader,
human or AI, and other documents reference it rather than restating it —
[`ENGINEERING_GUIDELINES.md`](ENGINEERING_GUIDELINES.md) § *Before writing code*
explains why it matters in practice, and [`plans/README.md`](plans/README.md)
applies it to plans.

**Concretely, four different things are documented here, and they must never be
confused:**

| If a document says… | It means | An implementer should |
|---|---|---|
| *Implemented* / listed under "What Exists Today" | It is in the code, today | Not rebuild it |
| *Planned* / *Approved* with a baseline | Decided, not yet built | Build it only under an approved execution plan |
| *Candidate* / *Conceptual* / *Vision* | An idea kept for coherence | **Not build it.** Not treat it as a commitment |
| *Open decision* | Nobody has chosen yet | Stop and ask the Product Owner |

---

## How a decision enters the documentation

Every decision follows the same path. Skipping a step is how knowledge ends up existing only in someone's memory, which PRODUCT_CONSTITUTION.md Core Belief 11 rules out.

```
Idea or problem
        ↓
Discussed — investigated in a plan (docs/plans/): options, costs, no choice made
        ↓
Decided by the Product Owner — recorded in the plan, with a baseline
        ↓
Approved execution plan — scope, acceptance criteria, out-of-scope
        ↓
Implemented
        ↓
Validated — `npm run verify` + the manual verification the plan calls for
        ↓
ADR written (if the decision was permanent) — see docs/adr/
        ↓
Promoted to the normative document it changed (if it changed what SETNAR is or does)
        ↓
Plan step marked implemented; plan archived when fully executed
```

**Why the ADR comes after implementation, not before.** Every plan in
`docs/plans/` states this explicitly: an ADR records what was actually
built and verified, not what was proposed. A pre-implementation design
document belongs in the plan (the *Discussed* step above); the ADR is the
durable record of the decision that survived contact with the code. This is
a deliberate, established convention — not a gap.

### Which document a decision lands in

A decision usually touches exactly one. If it appears to touch several, it is probably two decisions.

| The decision changes… | Goes to | Requires |
|---|---|---|
| Who SETNAR is, or a permanent principle | `PRODUCT_CONSTITUTION.md` | **Product Owner only.** Version increment, and a changelog line naming what changed and why. This should happen rarely — a Constitution that changes per sprint is not one |
| Strategy, audience, positioning, public narrative, business model | `PRODUCT.md` | Product Owner |
| What exists in the product | `PRODUCT.md` § *What Exists Today* | **Same PR as the code**, always — see *Documentation Definition of Done* |
| Stage sequencing, a hypothesis, entry/exit conditions | `ROADMAP.md` | Product Owner |
| Business vocabulary, an entity, an invariant, a status | `DOMAIN_MODEL.md` | Product Owner + whoever owns the affected domain |
| A module boundary, a layer, a dependency, tenant isolation | `ARCHITECTURE.md` | **ADR required** — these are the hard-to-reverse ones |
| Visual identity, a surface's experience rules, motion, accessibility | `DESIGN_SYSTEM.md` | Design + engineering agreement |
| Everyday practice: naming, tests, logging, review | `ENGINEERING_GUIDELINES.md` | Engineering agreement. No ADR needed |
| Nothing permanent — a step, an experiment, an investigation | `docs/plans/` | Nobody's approval to write; the Product Owner's to act on |

### When an ADR is required

**Required** when the decision is permanent, structural, hard to reverse, cross-cutting, or relevant to more than one module — anything a future reader would otherwise have to reverse-engineer from code and guess at the reasoning.

**Not required** for small or stylistic choices, or for anything reversible in a single commit. An ADR log padded with trivia is one nobody reads.

**The test:** *would someone six months from now, seeing this code, wonder why it was done this way — and would guessing wrong be expensive?* If yes, write the ADR.

An ADR is written **when the decision is implemented**, not when it is proposed. A proposal lives in a plan.

---

## The life of a plan

| Stage | What it means | Who moves it | Where it lives |
|---|---|---|---|
| **Proposed** | Written; raises options; decides nothing | Author | `docs/plans/` |
| **Approved** | The Product Owner has chosen, against a stated baseline | Product Owner | `docs/plans/` |
| **Implemented** | Every step shipped; ADRs written | Implementer | `docs/plans/` until superseded |
| **Superseded** | A later plan or ADR replaced it | Author of the replacement | `docs/plans/`, with `Superseded by:` filled in |
| **Archived** | Finished or abandoned; kept for the reasoning | Anyone, once true | `docs/plans/archive/` |

**A plan never gains authority at any stage.** "Approved" means the Product Owner agreed to the work, not that the plan became normative. Even an implemented plan is a historical record — the permanent output is the ADR and the updated normative document.

**A plan loses authority the moment its baseline moves.** Approval was given against a specific state of the code; when that state changes, the plan must be re-verified before further steps are executed. This is why `Code baseline` is mandatory in the header.

**How a permanent decision leaves a plan:** it is written into the ADR (why) and into the normative document it changes (what). Only then may the plan be archived. **A plan must never be archived while it is the sole record of a decision still in force.**

---

## When this documentation is re-verified

Documentation decays silently. These rules exist so that decay is caught by a process rather than by an audit years later.

**Three binding rules:**

1. **Any pull request that changes a customer-visible capability must update the affected normative documents in the same PR.** Not afterwards, not in a follow-up ticket. A capability that ships without its documentation has shipped an inconsistency into the source of truth.
2. **No release while `PRODUCT.md` § *What Exists Today* is out of date.** It is the one section the whole set depends on — every other document defers to it on the question of what exists. If it is wrong, everything downstream is wrong.
3. **Every closed sprint runs a reconciliation** between code, documentation and ADRs: verify *What Exists Today* against the code, confirm each shipped decision has its ADR, update the affected plan statuses, and re-date the verification block.

**Why sprint close rather than a calendar interval:** a calendar date drifts out of sync with the work, and gets skipped when nothing shipped. Sprint close is when someone already knows exactly what changed — the cheapest possible moment to reconcile, and the only one where the information is fresh.

**What must be re-verified at each reconciliation**, because these are the parts that age fastest:

- `PRODUCT.md` § *What Exists Today*, including its baseline commit, date and verifier
- `DOMAIN_MODEL.md` § 3.1 status tables
- `ROADMAP.md` Stage 1 capability statuses and *Still open*
- Plan headers in `docs/plans/`
- `PRODUCT.md` § *Brand authorization — current status*, which records an external fact SETNAR does not control
- This file's *Outstanding Documentation Debt*

This resolves debt item D9, which is retained below as a record of how the rule came to exist.

### Recommendation: `npm run docs:check` — not implemented

**Status: recommended, registered for a future ADR when it is built. Not implemented here** — this is a documentation-governance audit; adding a script and wiring it into CI is a code change, outside this audit's scope, and belongs to its own approved plan.

The three rules above are enforced by people today, which is D10 in the debt table below: a skipped sprint reconciliation is invisible until the next audit finds it. A future `npm run docs:check` — run in CI, and as part of `npm run verify` — would close that gap mechanically. It should validate:

- every internal link and anchor across `/docs` and the root `README.md` resolves;
- no duplicate ADR number in `docs/adr/`;
- every ADR file and every plan carries its required header fields;
- every plan referenced from a normative document exists at the path cited;
- the baseline date in `PRODUCT.md` § *What Exists Today* is no older than a configured threshold (e.g. the last closed sprint).

**When this is built, it gets an ADR** — it is a structural, permanent addition to how the project verifies itself, exactly the kind of decision `docs/README.md` § *When an ADR is required* describes. Recording the recommendation here, rather than silently building it, is what keeps this audit inside its own mandate.

---

## Documentation Definition of Done

`ENGINEERING_GUIDELINES.md` defines when *code* is done. This defines when the *change* is done. Both must hold.

A change involving a customer-visible capability is complete only when:

- [ ] `PRODUCT.md` § *What Exists Today* reflects reality, with baseline, date and verifier updated
- [ ] An ADR exists, if the decision was permanent, structural or hard to reverse
- [ ] `ROADMAP.md` reflects any stage capability that moved status
- [ ] `DOMAIN_MODEL.md` § 3.1 reflects any entity that changed status, and § 3 defines any new term
- [ ] `ARCHITECTURE.md` reflects any new module, boundary or dependency
- [ ] `DESIGN_SYSTEM.md` reflects any new surface rule or experience decision
- [ ] The relevant plan's step is marked implemented, and the plan archived if fully executed
- [ ] Every reference added points at a file that exists, by path
- [ ] No document now contradicts one above it in the hierarchy

**Not every item applies to every change**, and most changes touch two or three. What is never optional is the first: if the capability is visible to a customer and *What Exists Today* does not say so, the change is not done.

**A change that only touches internals** — a refactor, a test, a dependency bump — needs none of this, and forcing documentation onto it produces noise that makes the real updates harder to spot.

---

## Outstanding Documentation Debt

Known defects, deferrals and open questions **in the documentation itself**.

**This is not the product backlog.** Nothing here is a feature, and nothing here is fixed by writing code. A missing capability belongs in `ROADMAP.md`; a missing or wrong *document* belongs here. Items are removed only when resolved, never when merely inconvenient.

| # | Debt | Type | Impact if left | Owner decision needed |
|---|---|---|---|---|
| D1 | ~~Root `README.md` held 63 ADRs in 232 KB~~ | **Resolved 2026-08-05** | — | Closed by the `docs/adr/` migration. Retained as a record that the migration happened and why |
| D2 | ADR-058, ADR-059, ADR-060 and ADR-061 all cite `docs/AUDIT_CONSTITUTION_RECONCILIATION.md`, which does not exist in the repository (4 dangling references, not 1 — widened 2026-08-19 per `docs/plans/AUDIT_PRE_LAUNCH_CONSISTENCY.md` Achado 8) | Dangling reference | An auditor cannot follow the reasoning that led to adopting the Constitution | Restore the file, or amend the 4 ADRs to record that it was not retained |
| D3 | ~~Root `README.md` § *What is deliberately not here* and § *Next steps, in order* are stale — they list the dashboard and password recovery as absent, and both exist~~ | **Resolved** (confirmed 2026-08-19) | — | The root README no longer has sections under those names — it was rewritten with "What exists, and what doesn't" and "Current work and what's next" in their place, both correctly deferring to `PRODUCT.md`/`docs/plans/`. Retained as a record |
| D4 | Source comments and applied migrations cite `docs/<PLAN>.md`; the plans now live in `docs/plans/` | Stale path references | Links resolve by filename but not by path | Approve a doc-only comment update in `src/`, or accept (applied migrations must not be edited either way) |
| D5 | ~~Two permanent decisions live only in `SPRINT_E_PLAN.md` § 6~~ | **Corrected 2026-08-05, not a debt** | Re-verified directly against the ADR text, not assumed: "no Subscription row is created at onboarding" (§3.1, Option B) is fully captured in [`ADR-063`](adr/ADR-063-issubscriptionactiveuuid-productactivationsselectpublished-redefinida-enforcement-de-leitura-da-regra.md), with its own reasoning, not just a cross-reference. "Lead CTA disabled in preview" (§3.3) has no ADR because **E5 is not implemented** — the plan is correctly holding a decided-but-unbuilt item, exactly as the plan lifecycle intends; an ADR for unbuilt work would be premature, not missing | This row previously mischaracterized normal plan-pending status as a governance gap. No action needed |
| D6 | No numeric thresholds exist for any Stage 1 success criterion | Open decision | "Validated" cannot be declared objectively | Product Owner sets thresholds, or accepts qualitative judgement explicitly |
| D7 | `PRODUCT.md` records that presentation-layer code is iGreen-specific (identification label, compliance copy) | Documented limit, not a defect | Low — but the limit must be re-verified before a second organization is discussed | None until a second organization is real |
| D8 | The plan bodies still argue decided questions in the present tense; only their headers and § 3 maps were corrected | Accepted imprecision | A reader who skips the header can misread settled decisions as open | Accept, or approve a full rewrite of the plan bodies (loses the original reasoning) |
| D9 | ~~No document defines how often this documentation set is re-verified against code~~ | **Resolved 2026-08-05** | — | Closed by § *When this documentation is re-verified*. Retained as a record of why that rule exists |
| D10 | The reconciliation rules in § *When this documentation is re-verified* are process, enforced by people | Unenforced process | A skipped sprint reconciliation is invisible until the next audit | A concrete recommendation (`npm run docs:check`) is now recorded above, not implemented. Approve it as its own plan, or accept human enforcement |
| D11 | `docs/plans/archive/SPRINT_D_PLAN.md` § 1 lists seven product files as absent; that was true at the time and is a claim about a past state | Time-bound claim in an archived document | Low — the document is archived and marked historical | None. Recorded so a future reader does not re-investigate |
| D12 | 48 files in `src/` and `supabase/migrations/` (135 mentions, 11 explicit) cite ADR numbers with `README.md` as the location; ADRs now live in `docs/adr/` | Stale path references, same shape as D4 | Comments point to the wrong file, though the ADR number itself still resolves via the index | Approve a doc-only comment update in `src/`, or accept (applied migrations must not be edited either way) |
| D13 | `PRODUCT.md` § *What Exists Today*, billing paragraph (line ~196), still says Subscriptions are "activated manually" with "no payment gateway, billing flow, or automated Subscription lifecycle" | Stale, predates SET-28 through SET-35 (automated Asaas checkout, webhook, cancellation, reconciliation) and now SET-67 (free trial) | The one section every other document defers to on "what exists" currently understates the product by an entire shipped subsystem | Approve a full reconciliation pass of this paragraph against the current billing module — noticed while writing ADR-078, out of scope for that change to fix unilaterally |

**How to add to this list.** If you defer a documentation fix, record it here in the same commit as the deferral. A deferral that is not written down is indistinguishable from an oversight — and per PRODUCT_CONSTITUTION.md Core Belief 11, what is not written down does not bind the future.

---

## Practical entry points

- *What is SETNAR, and what may we say publicly?* → `PRODUCT.md`
- *What does the product actually do today?* → `PRODUCT.md`, § *What Exists Today*
- *What does this business word mean?* → `DOMAIN_MODEL.md` § 3
- *Is this entity real or conceptual?* → `DOMAIN_MODEL.md` § 3.1 (status table)
- *Why was it built this way?* → the ADRs in [`docs/adr/`](adr/README.md)
- *What is being worked on right now?* → [`plans/`](plans/README.md)
- *A billing incident is happening right now, what do I do?* → [`runbooks/BILLING_OPERATIONS.md`](runbooks/BILLING_OPERATIONS.md) — operational procedure, non-normative, same status as `plans/`
