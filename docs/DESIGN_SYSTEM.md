# DESIGN_SYSTEM.md

> Design System
> Version: 2.0
> Status: Active
> Authority: Level 6 — visual and behavioural experience (see `docs/README.md`)
> Product: SETNAR

---

# Purpose

This document defines the visual language, interaction principles, accessibility guidelines and reusable components of SETNAR.

The Design System exists to create a consistent experience across every surface SETNAR owns.

Every interface should feel like it belongs to the same system — which does not mean every interface has the same job.

---

# The three surfaces

SETNAR renders three distinct surfaces. They share tokens, components and accessibility standards; **they do not share purpose**, and a rule written for one of them is not automatically valid for the others.

| Surface | Who is looking | What it must achieve |
|---|---|---|
| **Product application** (`/app`, authenticated) | A representative doing work | Efficiency, clarity, minimum cognitive load |
| **Institutional landing** (`setnar.com`) | A prospect deciding whether to trust SETNAR | Credibility, comprehension, conversion |
| **Representative commercial page** (public) | A consumer deciding whether to trust a representative | Trust in that professional, and easy contact |

Each has its own section below. **Before applying any rule in this document, establish which surface it is being applied to.**

---

# Design Philosophy

Every interface decision must increase clarity. Clarity is never traded away — not for impact, not for beauty, not for novelty.

**The private application** is a professional work tool. It is optimized for a person doing repeated tasks: speed, predictability, and the lowest possible cognitive load. Users must immediately understand where they are, what they can do, and what happens next.

**The public surfaces** — the institutional landing and the representatives' commercial pages — are communication surfaces. They preserve clarity and trust, and they *additionally* carry the job of persuading someone who has no prior relationship with SETNAR or with a representative. Visual storytelling, editorial composition, product demonstration and controlled motion are legitimate there, because conveying quality, innovation and security **is** their function.

The rule that replaces "never design to impress":

> **The interface must not sacrifice clarity in order to impress.** The perception of excellence must come from consistency, finish and precision — never from decoration compensating for a weak idea.

This distinction matters because the previous version of this document stated "SETNAR is not a marketing website" as a global rule. That was false for two of the three surfaces, and it was being used to justify visually inert public pages whose actual job is to earn trust.

---

# Core Principles

## Simplicity

Every screen should solve one problem.

Avoid unnecessary elements.

---

## Clarity

Every action should be obvious.

Users should never wonder:

"What should I click?"

---

## Consistency

The same action should always look and behave the same way.

Never reinvent components.

---

## Accessibility

Accessibility is mandatory.

Not optional.

Every component must be usable by everyone.

---

## Performance

Interfaces should feel instantaneous.

Motion must never delay an action the user has already decided to take. What motion is *for* differs by surface — see *Motion*.

---

# Design Personality

SETNAR should feel:

Professional

Reliable

Minimal

Modern

Clean

Fast

Confident

Never:

Playful

Childish

Flashy

Overloaded

Gamified

---

# Design Inspiration

SETNAR draws inspiration from Stripe, Linear, Vercel, Notion, GitHub, Figma, Framer and Raycast.

**What may be taken from them:** level of finish, rhythm, precision, interaction quality, the discipline of their empty and error states, the restraint of their motion.

**What must not be taken from them:** their visual identity. Copying a hero layout, a gradient treatment, or a signature component makes SETNAR look derivative to exactly the audience whose trust it needs — people who have seen the original.

The goal is to meet their standard, not to resemble them.

---

# Visual Identity

Visual communication is carried primarily by whitespace, typography, alignment, hierarchy and consistency — not by gradients, heavy shadows, large illustrations or decorative effect.

This is a statement about **where the work goes**, not a ban list. On the public surfaces, a gradient, an illustration or a depth effect may legitimately serve a narrative or demonstrative purpose. What is prohibited is using them to substitute for structure: an interface whose hierarchy is weak is not fixed by decoration, only disguised.

In the product application, the restrictive reading holds as written: whitespace and typography do the work.

---

# Color Philosophy

Color communicates meaning first. Every color must have a purpose — semantic (state), structural (hierarchy), or identity (brand). Color applied for none of those three reasons is the decoration this rule excludes.

Colour must never be the only carrier of meaning (see *Accessibility*).

Primary

Represents actions.

Secondary

Represents supporting information.

Success

Positive confirmation.

Warning

Requires attention.

Danger

Critical action or error.

Neutral

Everything else.

Avoid excessive color usage.

Interfaces should remain visually calm.

---

# Typography

Typography is the primary visual element.

Preferred font:

Plus Jakarta Sans

Fallback:

System UI

Hierarchy

Display

Heading

Title

Subtitle

Body

Caption

Typography should communicate importance.

Never rely on color alone.

---

# Spacing

Spacing defines structure.

Use an 8-point grid.

Allowed spacing values:

4

8

12

16

24

32

40

48

64

96

Spacing between elements comes from this scale. A value outside it needs a reason — a one-off optical correction is a legitimate reason, "it looked better" without knowing why is not. What the scale prevents is a layout accumulating a dozen unrelated near-identical values.

---

# Border Radius

Use subtle rounding.

Small

Medium

Large

Extra Large

Avoid exaggerated rounded corners.

Professional software should feel precise.

---

# Shadows

Use shadows sparingly, to separate layers. Prefer borders over shadows in the product application, where a flat, precise surface reads as a tool rather than a brochure.

On the public surfaces, depth may carry compositional purpose — establishing focus or layering a demonstration. What is excluded on every surface is elevation applied to make an element look more important than its role justifies.

---

# Icons

Use a single icon library.

Recommended:

Lucide

Icons should be consistent and lightweight, and they support labels rather than replacing them.

**The exception, which is common enough to state:** an icon-only control is acceptable where the icon is a near-universal convention and space genuinely does not permit a label — a close button, a copy button in a tight row. In every such case the control **must** carry an accessible name (`aria-label` or visually-hidden text). "No visible label" is a layout decision; "no accessible name" is a defect.

An icon must never be the only carrier of meaning for a *state* — the same rule as colour.

---

# Layout

Application Layout

Sidebar

↓

Header

↓

Content

↓

Footer (optional)

Content width should maximize readability.

Avoid stretching interfaces across ultra-wide monitors.

---

# Responsive Design

Mobile First.

Breakpoints should prioritize:

Mobile

Tablet

Desktop

Large Desktop

Every feature must be usable on every supported device. Presentation may differ by viewport; **capability must not** — no feature is desktop-only.

Where a platform genuinely constrains behaviour (file download and clipboard access differ across mobile browsers), the feature must degrade to a working alternative rather than disappearing.

---

# Grid System

Use CSS Grid whenever appropriate.

Use Flexbox for alignment.

Avoid deeply nested layouts.

---

# Component Philosophy

Components are reusable building blocks.

Every component must be:

Composable

Reusable

Accessible

Predictable

Documented

---

# Core Components

**This document does not maintain an inventory of components.** It previously listed twenty-five, of which about half existed — a list that reads as a backlog and goes stale with every sprint.

**The authoritative inventory is the code**: `src/shared/ui/` is the folder, and `src/shared/ui/README.md` documents the tokens and the two rules those components implement. A list here could only ever be a slower, wronger copy of what a directory listing answers exactly.

What this document owns is the principle, which does not go stale:

- **A component is created when a real feature needs it**, never in advance. A component with no consumer is speculative work (`ARCHITECTURE.md`, YAGNI).
- **A missing component is not a gap.** Several obvious candidates — tables, pagination, charts — presuppose capabilities that are Conceptual (`DOMAIN_MODEL.md` § 3.1). Building them now means building for screens that do not exist.
- **A component belongs in `shared/ui` once it has more than one consumer.** Until then it lives in the module that uses it. Two components sit outside `shared/ui` today for exactly this reason; that is correct, not debt.
- **Whenever one is built:** one responsibility, composable, accessible, predictable, documented.

The component *categories* SETNAR expects to need — inputs, containers, overlays, feedback, navigation, data display — are stable enough to design against. Which ones exist on any given day is a question for the code, not for this file.

---

# Buttons

Primary

Main action.

Secondary

Alternative action.

Ghost

Low emphasis.

Danger

Destructive action.

Never create unnecessary button variants.

---

# Forms

Forms should be simple.

Only request required information.

Every field must include:

Label

Validation

Helpful feedback

Errors should explain how to recover.

---

# Tables

Tables exist for management.

Not presentation.

Support:

Sorting

Filtering

Pagination

Selection

Responsive behavior

---

# Empty States

Every empty state should answer:

What happened?

Why?

What should the user do next?

Empty states should encourage action.

Never leave blank screens.

---

# Loading States

Never freeze interfaces.

An async action whose result is not effectively immediate must display progress.

Preferred: skeletons. Secondary: spinners. Avoid full-page loading screens.

**The exception is deliberate:** an indicator that appears and disappears within roughly 100–200 ms reads as a flicker and makes the interface feel *less* stable, not more responsive. For actions that usually complete that fast, delay the indicator rather than showing it immediately — and never show one so briefly that the user perceives a flash instead of feedback.

What has no exception: **the interface must never appear frozen.** If an action may take longer than a moment, the user must be able to tell that it is running.

---

# Feedback

Every user action requires feedback.

Success

Warning

Error

Loading

Feedback should be immediate.

---

# Notifications

Notifications should be:

Short

Actionable

Non-intrusive

Avoid modal dialogs unless absolutely necessary.

---

# Motion

Motion has different legitimate purposes on different surfaces, so a single global duration cap is the wrong instrument.

**The three surfaces do not share a motion policy**, and the earlier two-way split (private vs. public) was too coarse — it grouped the representative's commercial page with the institutional landing, which have different audiences and different risks:

| Surface | Motion is for | Editorial / ambient motion |
|---|---|---|
| **Product application** (`/app`) | Explaining a transition, reducing confusion, guiding attention. Nothing else | **Not permitted** — a work tool that animates is a work tool that is slower |
| **Institutional landing** (`setnar.com`) | All of the above, plus: demonstrating the product, reinforcing perceived quality, showing how capabilities relate, carrying narrative, communicating transformation | **Permitted**, within the constraints below |
| **Representative commercial page** | All of the product-application purposes, plus modest reveal that aids comprehension of the offer | **Sharply limited.** This page's job is that a stranger trusts a named professional and makes contact. Motion that reads as marketing production works against that — and it is the representative's credibility being spent, not SETNAR's |

The commercial page's restraint is not a stylistic preference. A visitor deciding whether an independent professional is legitimate reads polish-for-its-own-sake as sales pressure. **Restraint is the credibility signal there**, where on the landing, finish is.

The limit that applies everywhere:

> **Motion must never compete with comprehension.** Sophistication comes from precision, contextual response and finish. Movement without perceptible function, narrative or feedback is noise.

## Duration categories

Replaces the previous flat 300 ms ceiling.

**Microinteractions** — hover, focus, toggle, tooltip, button feedback.
Typical range: **~100–300 ms**. Anything slower feels laggy on an action the user just took.

**Component transitions** — accordion, modal, menu, state change, panel expansion.
Typical range: **~200–500 ms**. Long enough to be followed, short enough not to be waited on.

**Editorial animation (landing only)** — section entrances, flow demonstrations, connections between blocks, progressive reveal, interactive mockups.
Duration is contextual and no fixed ceiling applies. The constraint is behavioural, not numeric: **it must never block reading or interaction.** Content is readable and actionable whether or not its entrance animation has finished.

**Ambient motion** — very slow gradients, subtle glow, gentle depth shifts, non-essential loops.
Must be: slow; understated; non-essential; pausable where applicable; **removed entirely under `prefers-reduced-motion`**; and limited to a few deliberate points. Ambient motion on every element is not atmosphere, it is restlessness.

## Technical constraints

These apply to all motion, on every surface:

- animate `transform` and `opacity` by preference;
- never cause layout shift;
- avoid animating expensive properties (layout- or paint-triggering);
- **respect `prefers-reduced-motion`** — this is an accessibility requirement, not a preference;
- never break or trap keyboard navigation;
- never obscure content;
- never delay an essential action;
- no heavy persistent loops;
- avoid large animation libraries without a stated justification;
- maintain performance on mid-range devices, and test on real mobile hardware;
- **no scroll hijacking**;
- no custom cursor that impairs use;
- **no content whose meaning depends on the animation** — the message must survive motion being removed entirely.

That last constraint is the test that matters most: turn every animation off, and the page must still be complete, comprehensible and persuasive.

---

# Data Visualization

Charts should prioritize readability.

Minimal grid lines.

Minimal colors.

Clear labels.

Readable legends.

Never use 3D charts.

Never distort data.

---

# QR Code Component

QR Codes are a core product feature.

A QR Code component **must** support:

- **Download** — implemented
- **Copy link** — implemented
- **Preview** — implemented (the code is rendered on screen; "preview" is the rendering itself, not a separate mode)
- **Responsive sizing** — implemented
- A resolved loading state, since generation is asynchronous — implemented
- An explicit generation-error state with retry — implemented
- Clipboard success/failure feedback and a selectable manual-copy fallback — implemented

**"Regenerate" is not a requirement, and was removed.** It presupposes a stored QR Code that could drift from its target. No QR Code is persisted: it is derived from the page's public address every time it is rendered (ADR-049), so it cannot go stale and there is nothing to regenerate. Listing it as mandatory would have sent someone to build a button for a problem the architecture already prevents.

Retrying after a client-side generation error is not regeneration: it repeats the same deterministic rendering attempt for the same public address and persists nothing.

Should QR Codes ever become persisted artifacts — for example, campaign-scoped codes with their own analytics — regeneration becomes a real requirement at that point, and this section is revised then. `DOMAIN_MODEL.md` § 8.7 models that possibility; it is Conceptual (§ 3.1).

---

# Product Application Experience

The authenticated surface, where a representative works.

**Optimize for:** efficiency, predictability, minimum cognitive load, low friction on repeated tasks.

- Every screen solves one problem.
- The primary action on any screen is unmistakable.
- State is always legible: what is published, what is not, and what is blocking publication.
- Motion is restricted to microinteractions and component transitions.
- Nothing is sold here. The representative has already decided; this surface helps them execute.
- Empty states explain what happened, why, and what to do next — this surface is where a new representative is most likely to be lost.
- The Stage 1 App Shell exposes only **Pages**, **Contacts** and **Account**. Contacts is the read-only inbox for interest already captured by the representative's pages — not a CRM. Desktop uses a compact sidebar; mobile uses an always-visible labeled header navigation. Both carry visible focus and `aria-current`; links to unimplemented capabilities are prohibited.

---

# Public Brand Experience

The institutional landing, `setnar.com`. Its job is that a stranger decides SETNAR is real, competent and safe to sign up for.

## What it must convey

Credibility · innovation · security · professionalism · clarity · organization · maturity · attention to detail · sophisticated simplicity · confidence to act.

## What it must never convey

Improvisation · generic-template appearance · exaggerated marketing · childishness · visual excess · empty futuristic aesthetics · complexity · instability · aggression · commercial desperation · miracle promises.

## Credibility, as verifiable behaviour

Adjectives are not specifications. Credibility on this surface means, concretely:

- **specific language** — concrete claims about what the software does, never vague superlatives;
- **real demonstrations** — showing the actual product, not an idealized illustration of it;
- **consistency** across every section, in spacing, tone and treatment;
- **strong hierarchy** — a reader can extract the point from headings alone;
- **complete interface states** — no dead links, no placeholder text, no unbuilt destinations styled as working ones;
- **rigorous alignment** — a single misaligned element reads as carelessness about everything else;
- **stable typography** — no shifting, no reflow after load;
- **clear domain and identity** — no ambiguity about whose site this is;
- **findable legal information**;
- **no fictional content** — no invented metrics, customers, testimonials or seals (`PRODUCT.md` § *Limits of public communication*);
- **no visual defects** — misalignment, overflow, broken responsive behaviour;
- **refined finish** in the details a careless build gets wrong;
- **clarity about what exists** — never describing future capability in the present tense;
- **an unmistakable distinction between SETNAR and the organizations its users represent.**

## Innovation, as experience

Innovation is demonstrated, not asserted. It appears as:

- careful microinteractions;
- contextual response to the cursor;
- interactive demonstrations of the real product;
- precise transitions;
- moderate depth;
- non-generic composition;
- motion with purpose;
- progressive storytelling;
- components that communicate system and integration;
- details that evidence engineering care.

Innovation is **not**: random particles; gradient excess; floating objects with no function; continuous animation on everything; AI jargon unbacked by real capability; excessive rotation; bounce; effects that impair reading; or literal visual copying of another company.

## Security, as perception

Security here is not only cybersecurity. Perceived trust is part of the user experience, and it comes from:

- clarity of identity;
- predictability;
- transparency;
- visual stability;
- legibility;
- unambiguous CTAs;
- **absence of dark patterns**;
- trustworthy feedback;
- accessible legal information;
- respect for authorization;
- **never imitating the represented organization**;
- domain consistency;
- absence of vague promises;
- predictable interface behaviour.

---

# Representative Commercial Page Experience

The Commercial Page a representative shares. Its job is that a consumer trusts **the representative** and makes contact.

**This is a communication and conversion surface, not a dashboard.** It also carries obligations the other two surfaces do not.

## Non-negotiable

- **Authorized identification is always present** — the representative's real name, their authorization identifier, and their own contact details. Trust comes from disclosure, never from resemblance (PRODUCT_CONSTITUTION.md, Core Belief 1).
- **The page must never look like an official page of the represented organization.** Authorship must be unambiguous to a visitor who is not paying close attention.
- **The compliance notice for the product is a publication precondition**, not a template detail (ADR-055).
- No invented claim about results, earnings or price.

## Structure

The page carries the representative's identification, the product, contact information, and a call to action.

**A photo and a free-text description are optional, and neither exists in the product today.** The earlier version of this document listed both as page contents, which read as a requirement and was doubly wrong: representative photos are not implemented at all (there is no upload, and `avatar_url` is unused), and the page renders no description field. A component or a review that treats either as mandatory would be blocking on a capability that was never built.

When a photo does ship, it must remain **optional**: a representative who has not uploaded one must still get a complete, credible page. Credibility here comes from verifiable identification — real name, authorization identifier, real contact details — not from a portrait. A layout that looks broken without a photo has made an optional field structurally required, which is a design defect.

**"No distractions" means a single, unambiguous call to action — not an absence of content** (ADR-056). Content that helps a visitor understand and trust the offer — explanatory tabs, FAQs, how-it-works, calculators — is legitimate. What is prohibited is *competing* actions, unnecessary navigation, and anything that pulls the visitor away from the one conversation the page exists to start.

The page exists to convert visitors into conversations.

---

# Accessibility

Minimum standard:

WCAG AA

Requirements:

Keyboard navigation

Focus indicators

Screen reader support

Contrast compliance

Semantic HTML

ARIA only when necessary.

---

# Dark Mode

**Structural support exists. The capability is not available to users.**

The distinction matters and was previously collapsed into "Dark Mode is supported," which overstated it:

| | Status |
|---|---|
| Dark theme tokens defined | **Yes** — a full token set in `globals.css`, class-based |
| Components built against tokens rather than literal colours | **Yes** |
| A way for a user to switch themes | **No** — no toggle is exposed anywhere |
| System-preference detection | **No** |
| Dark mode verified across every surface | **No** — never rendered in production use |

What this means in practice:

- **A new component must use theme tokens** rather than literal colours. That is the standing requirement, and it is what keeps the option open.
- **A component is not required to be visually verified in dark mode**, because there is no user-reachable path to it. Blocking work on dark-mode review today would be reviewing a state nobody can enter.
- **Dark mode must not be described as an available feature** to users or in public material.

When a theme switcher ships, this section is revised and a verification pass across all three surfaces becomes a real requirement. Until then it is a preserved option, not a delivered capability.

---

# Performance

Every component should:

Lazy load when appropriate.

Avoid unnecessary renders.

Avoid layout shift.

Avoid blocking rendering.

---

# Design Tokens

Tokens exist so identity, theme and scale can change in one place. They are **mandatory** for colour, spacing, typography, radius, shadow, border, opacity and transitions wherever those values are reused, semantic, part of a scale, or theme-dependent.

A local, one-off, non-semantic value may stay next to the component that uses it. Turning a single optical correction into a global token adds a name and implies a reuse that does not exist.

Full rule, with the test to apply: `ENGINEERING_GUIDELINES.md` § *Styling*.

---

# Component Documentation

Every reusable component must include:

Purpose

Usage

Properties

Accessibility notes

Examples

Known limitations

---

# Future Evolution

The Design System should be able to absorb future modules without redesign — CRM, analytics, campaigns, AI, marketplace, white label.

**None of these exists, and listing them here is not a plan to build them** (`ROADMAP.md`, `DOMAIN_MODEL.md` § 3.1). The point is a constraint on today's decisions: do not adopt a pattern that would have to be thrown away if one of these ever arrived. It is not a licence to build components for surfaces that do not exist — a component with no consumer is speculative work, not preparation.

Consistency must survive product growth.

---

# Final Principle

Users should notice how easy SETNAR is to use.

They should never notice the Design System itself.

Great design becomes invisible.

It simply helps people accomplish their work.
