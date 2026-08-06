### ADR-006 — Brand typeface self-hosted via `@fontsource-variable`
**Decision.** Ship Plus Jakarta Sans from npm rather than `next/font/google`.
**Why.** No third-party request at runtime, nothing for a privacy review to
raise later, and no build-time dependency on an external service.
**Open conflict.** `DESIGN_SYSTEM.md` names Inter as the preferred font; the
visual identity guide names Plus Jakarta Sans. The identity guide won, being the
more specific and more recent artefact. **`DESIGN_SYSTEM.md` should be updated
so the contradiction does not resurface.**
**Reversal cost.** One token: `--font-sans` in `globals.css`.
