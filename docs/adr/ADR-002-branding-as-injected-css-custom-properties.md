### ADR-002 — Branding as injected CSS custom properties
**Decision.** Tailwind consumes `rgb(var(--token) / <alpha-value>)` for every
colour; the tenant's palette is injected into `<head>` on the server.
**Why the RGB-channel format.** Storing `#14213D` would break every Tailwind
opacity modifier (`bg-brand/10`). Storing `20 33 61` keeps them working.
**Consequence.** White-labelling is a data change. Dark-mode tokens are already
defined for the same reason; no toggle ships yet (YAGNI) — adding one means
writing `dark` onto `<html>`.
**Reversal cost.** Low.
