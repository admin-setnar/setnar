# PRODUCT CONSTITUTION

> Product Constitution
> Version: 1.2
> Status: Active — complete (see § 6)
> Authority: Level 1 — highest (see `docs/README.md`)
> Owner: SETNAR

> **Changes in 1.2 (2026-08-05).** Core Belief 5 no longer reduces progress to
> opportunities; Core Belief 12 requires abstraction before a customer-specific
> capability enters the core; Core Belief 13 no longer equates the
> professional's success with selling more. § 6 records that this document is
> complete. No principle was removed and no new principle was added.

---

# 1. Preface

This document exists because a product that grows across many decisions, many contributors, and many years needs something more stable than any single specification: a record of why it exists at all, and what it will never stop being.

Every other document in this project — PRODUCT.md, ROADMAP.md, ARCHITECTURE.md, DOMAIN_MODEL.md, ENGINEERING_GUIDELINES.md, DESIGN_SYSTEM.md, and every Architecture Decision Record — describes how SETNAR is built, staged, or governed at a point in time. Those documents are expected to change: features ship, priorities shift, technical decisions get revisited. This document is not expected to change in the same way. It describes the identity SETNAR does not get to renegotiate.

### Authority

The Constitution is the highest-authority document in this project. Where any other document conflicts with a principle stated here, the Constitution prevails, and the conflicting document must be revised to comply with it — not the other way around. This authority is deliberately narrow: the Constitution governs identity, purpose, and principle. It has no opinion on frameworks, schemas, endpoints, or feature scope, and it must never be read as though it does.

### Scope and complements

This document complements, and does not replace, the rest of the project's documentation:

- **PRODUCT.md** translates purpose into strategy, audience, and product principles.
- **ROADMAP.md** sequences validation, stage by stage.
- **ARCHITECTURE.md** and **DOMAIN_MODEL.md** define how the business and the system are modeled and built.
- **ENGINEERING_GUIDELINES.md** and **DESIGN_SYSTEM.md** define day-to-day standards.

Where those documents are silent or ambiguous, the Constitution is the place to look for intent. Where they are explicit, they should already be consistent with it — and where a future reader finds they are not, that inconsistency is a defect in the other document, not a license to reinterpret this one.

### Who should use it

Anyone making a decision that will outlive the current sprint should read this document first — product, engineering, design, and any AI system acting as an implementation partner. It is written to be read once for orientation and returned to whenever a decision feels ambiguous, contested, or larger than its immediate scope.

### How to interpret it

The Constitution defines permanent principles. It does not describe implementations.

Every statement in this document should be readable with no knowledge of what SETNAR's interface looks like today, what it is built with, or which organization or market it currently serves. It must remain accurate whether SETNAR is used by one authorizing organization or by thousands, across any category of authorized independent representation — including ones that do not yet exist. If a future reader cannot tell whether a sentence was written before or after a specific feature shipped, or before or after any single customer stopped using SETNAR, the sentence is doing its job. If a sentence depends on today's product surface, today's market, or today's customers to make sense, it does not belong here.

---

# 2. Purpose

SETNAR is the infrastructure layer for authorized independent representation.

SETNAR exists because independent professionals who sell on behalf of an authorizing organization — under their own name, their own effort, and their own risk — have no infrastructure of their own to be found, trusted, and safely represented by that organization at the same time.

This is a permanent condition, not a product opportunity. Every category of commerce that authorizes people to sell rather than employing them to sell reproduces it: brokers, agents, licensees, consultants, franchisees, and every category not yet organized this way. The specific products change. The specific organizations change. The underlying condition does not — someone is selling on behalf of someone else, independently, and both sides need that representation to look credible and stay within bounds without either one building the infrastructure for it themselves.

This condition predates SETNAR and will outlast any single organization or market SETNAR happens to serve today. SETNAR exists to be its infrastructure — not the infrastructure of any one company within it.

### Rationale

This purpose is deliberately narrower than "help people sell" and deliberately broader than "generate commercial pages." Both alternatives were considered and set aside.

"Help people sell" describes almost every sales tool that exists and gives no basis for deciding what SETNAR should refuse to become. It would justify a CRM, a social network, a payment processor, or an advertising platform with equal force, none of which are what SETNAR is for.

"Generate commercial pages" describes an artifact SETNAR happens to produce, not the reason it produces it. A page is a means. If SETNAR were still producing pages years from now but had stopped solving the underlying problem, it would have failed by this Constitution's standard even while succeeding by a narrower, artifact-based one.

The purpose above is anchored to a relationship, not an artifact: an independent professional, authorized by an organization, needs to be discoverable and trustworthy to a customer, and the authorizing organization needs assurance that this representation stays inside the boundaries it defines. This relationship is what stays constant even as the tooling that serves it changes, the organizations that need it change, and the market SETNAR started in changes. Anchoring the Constitution to it — rather than to pages, dashboards, any current market, or any current customer — is what allows this document to remain accurate independent of what SETNAR looks like, who it serves, or which organizations exist at any given time.

---

# 3. Mission

SETNAR fulfills its purpose by giving every authorized independent professional a digital presence generated for them, not built by them — one that carries their identity, reflects what they are actually authorized to represent, and stays inside the rules their authorizing organization sets, without requiring either side to employ a developer, a designer, or a compliance reviewer to keep it that way.

Credibility and compliance are treated as properties of the infrastructure itself, not as responsibilities left to the professional's judgment or to the organization's oversight after the fact. A representative should not need training to look legitimate. An organization should not need to police representation, one professional at a time, to stay protected.

---

# 4. Vision

Today, whether an independent representative looks professional is mostly a matter of individual effort and improvisation — some build their own presence, some rely on little more than a phone number and a photo, and most fall somewhere in between with no consistency and no oversight from the organization they represent. Whether their representation stays within brand, legal, and commercial bounds is handled, if at all, after the fact: agreements signed once, enforcement invoked only once something has already gone wrong.

This is not a stable equilibrium. As more categories of commerce shift toward authorizing independent professionals rather than employing them, the gap between how credible a representative could look and how credible improvisation actually makes them look only widens — and any organization that authorizes representation at scale eventually needs a way to guarantee its quality that does not depend on trusting each professional's individual effort.

SETNAR's vision is to be the infrastructure that closes that gap before the market is forced to close it some other way. In the market SETNAR intends to shape, an independent representative's digital presence is not something built once and left alone, nor something the authorizing organization discovers has gone wrong after a complaint — it is correct from the moment it exists, changes automatically as what the representative is authorized to offer changes, and gives the authorizing organization confidence without taking away any of the representative's independence.

Carried across every category of authorized independent selling this pattern applies to, SETNAR's long-term position is to become the layer authorizing organizations rely on instead of leaving digital representation to chance, and the layer independent professionals rely on instead of building that presence themselves, one improvised page at a time.

---

# 5. Core Beliefs

Each belief below is a standing test. A decision that violates one of these should be treated as wrong even if it would improve a short-term metric.

1. **Trust is earned through transparency, never through resemblance.** A representative's credibility must come from who they verifiably are — their identity, their authorization, their real affiliation — not from a presence designed to be mistaken for something it is not. Anything that borrows credibility through resemblance rather than earning it through disclosure is a liability, regardless of how well it might convert in the short term.

2. **Compliance is infrastructure, not a feature request.** The rules that govern what a representative may claim, promise, or imply are not an obstacle to route around — they are a primary reason this kind of representation needs to be built by a platform rather than improvised by each professional alone. A platform that treats compliance as optional has built the wrong product.

3. **SETNAR is infrastructure, never a principal.** The identity, reputation, and authority in this relationship belong to the professional and to the organization that authorizes them — never to the platform that connects them. SETNAR gives a professional's identity a credible expression; it does not own it, gate it, or become a substitute for the organization that authorizes their representation. A professional who leaves must be able to take their history and credibility with them, and an organization that ends an authorization does not need SETNAR's permission to do so.

4. **Automation amplifies the professional; it never substitutes their identity or their decisions.** Every capability that removes operational work from a representative's day is worth building. None of them are worth building if they start speaking, deciding, or acting as the representative instead of for them. The line between assisting a professional and replacing one is not a technical detail — it is a permanent boundary.

5. **Progress is measured in value delivered, never in artifacts shipped.** A page, a report, or a feature has no value in itself. Value takes several forms, and reducing them to one produces a distorted roadmap:
   - **trust** a professional gains with a customer who can now verify who they are;
   - **risk removed** for the authorizing organization, whose representation stays inside its rules without being policed one professional at a time;
   - **quality of representation** — a professional presented as well as their work deserves, without needing the skill to do it themselves;
   - **commercial opportunity** created for a real professional;
   - **durable capability** added to the platform itself.

   A roadmap full of shipped work that produces none of these has not made SETNAR more valuable; it has only made it more complicated. Commercial opportunity is the most easily counted of the five, which is exactly why it must not be allowed to stand in for the other four.

6. **One relationship proven is worth more than many assumed.** The right to serve a new category of independent professional, or a new authorizing organization, is earned by proving the model works for the one currently served. Expansion follows validation; it never substitutes for it.

7. **The authorizing organization and the professional it authorizes are both being served, and their interests are not automatically aligned.** SETNAR sits in the middle of a relationship with two sides, not one. A decision that improves a representative's conversion at the expense of the organization's compliance, or the reverse, has not resolved that tension — it has picked a side that was not SETNAR's to pick unilaterally.

8. **No organization is the platform; every organization is a tenant of it.** SETNAR's usefulness depends on never becoming structurally dependent on any single authorizing organization, however important that organization is to its early success. Its architecture, its vocabulary, and its business model must all be able to describe a second organization, and a thousandth, as easily as the first.

9. **Complexity belongs to the platform, never to the customer.** Every difficulty SETNAR chooses not to absorb is a difficulty it has handed to a professional who came to it precisely to avoid that kind of work. A platform that becomes harder to understand as it grows has not scaled — it has exported its own complexity to the people least equipped to carry it.

10. **Excellence is the default outcome, not an achievable one.** A representative should never need expertise, taste, or extra effort to produce something excellent — the platform is responsible for preventing a mediocre result, not merely for making a good one possible. If reaching a professional standard depends on skill the representative doesn't have, the product has not yet done its job.

11. **What is not written down does not bind the future.** A principle, rule, or architectural decision that exists only in someone's memory does not meaningfully exist. Documentation is what lets the next decision — made by a person or by an AI system — inherit the reasoning behind the last one, instead of guessing at it.

12. **What is validated *and abstracted* for one becomes permanent capability for all.** A capability proven for one organization or professional is not reinvented for the next one who needs it. But the path from "it worked for one customer" to "it is part of the platform" runs through abstraction, and that step is not optional: **specific work does not become a permanent capability merely by having succeeded.** Not every customization deserves to be generalized — some are genuinely particular to one customer, and absorbing those into the core is how a product quietly becomes a collection of other people's requirements. The test is whether the underlying capability, stripped of the customer that motivated it, is something the platform should offer everyone. When the answer is yes, it is abstracted and it rises into the baseline permanently. When the answer is no, it stays where it is. SETNAR is not a collection of custom deployments accumulating around its customers; it is a single platform whose baseline rises with every validated *and generalizable* improvement.

13. **The professional's success comes first, and the platform's success follows from it.** If SETNAR is thriving by its own metrics while the professionals on it are gaining nothing, a principle in this Constitution has already been violated — even if no other document has noticed yet.

    "Gaining nothing" is deliberate, and broader than "not selling more." A sale depends on the professional's own effort, their market, their offer, and their price — variables SETNAR does not control and must never claim to. What SETNAR is accountable for is the conditions: whether a professional is findable, verifiable, credible, easy to contact, and correctly represented. A platform that delivers those conditions to professionals whose sales did not move has not failed this principle. A platform whose professionals are more visible in its dashboards than they are to their own customers has.

---

---

# 6. Completeness of this document

**This Constitution is complete as it stands.** There is no Part 2, no pending section, and nothing deliberately withheld. Earlier drafts closed with a note describing this as "Part 1," which was accurate while the document was being written and became misleading once it was adopted (ADR-058) — a constitution that appears unfinished invites readers to assume that some governing principle exists somewhere else. None does.

Should a future principle be added, it is added here, as a numbered Core Belief, with a version increment — never as a separate document.

*This document defines permanent principles; it does not describe implementations. Every future document — and every future version of PRODUCT.md, ROADMAP.md, ARCHITECTURE.md, and DOMAIN_MODEL.md — must remain compatible with it.*
