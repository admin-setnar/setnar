### ADR-010 — Ambient declarations for asset imports
**Decision.** `src/types/assets.d.ts` declares `*.css`, `*.scss` and font
modules.
**Why.** Next ships types for `*.module.css` but not for plain `*.css`, so
`import '@/app/globals.css'` has nothing to resolve to. TypeScript only
complains when `noUncheckedSideEffectImports` is enabled — which some editors
and stricter configurations do — producing *"Cannot find module or type
declarations for side-effect import"* while the build itself works fine. The
declaration removes the discrepancy between what the editor reports and what
the bundler does.
**Reversal cost.** None.
