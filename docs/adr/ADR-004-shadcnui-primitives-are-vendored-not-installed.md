### ADR-004 — shadcn/ui primitives are vendored, not installed
**Decision.** Build the primitives directly on Radix + CVA + `tailwind-merge`,
which is exactly what the shadcn CLI produces.
**Why.** shadcn is a copy-into-your-repo generator, not a runtime dependency.
Vendoring gives the same result with no generator step, and lets each component
carry the documentation block `DESIGN_SYSTEM.md` requires (purpose, states,
accessibility notes) instead of generic boilerplate.
**Reversal cost.** None — the CLI can still be pointed at this project.
