Marketing materials — reference only, not served code

These 21 React/CSS Modules pieces (7 verticals × Post/Story/Poster) are the
source-of-truth visual reference for the marketing-materials feature (SET-65),
handed off already close to production shape — real components, not static
HTML with `{{TOKEN}}` placeholders like `templates/commercial-pages/`.

They are NOT built, served, or imported by the Next.js app. The ported,
production versions live in `src/modules/marketing-materials/` — see
`docs/plans/MARKETING_MATERIALS_PLAN.md` for the investigation that led to
the port, and `docs/adr/ADR-090-materiais-de-marketing-exportam-via-captura-client-side.md`
for the export-pipeline decision.

This folder exists so the exact composition, copy, typography choices per
vertical (`fonts.ts`), and the `MarketingMaterialProps` contract shape can be
diffed directly against the reference. Do not edit these files as part of
implementing or fixing the feature; if a piece itself needs a content or
design change, that's a product decision made here first, then ported — not
the other way around.

`shared/registry.tsx` and `shared/ScaledFrame.tsx` were scaffolding for a
preview gallery that was never wired to any route in this reference
repository — the production port (`src/modules/marketing-materials/registry.ts`,
`presentation/scaled-frame.tsx`) is the one actually in use.
