### ADR-007 — Server Components by default, three client islands
**Decision.** The page is a Server Component. Only three things run on the
client: `Navbar` (scroll state and mobile menu), `AuthTriggerButton` (opens a
modal), and `Reveal` (scroll transition).
**Consequence.** The initial HTML contains zero form inputs — verified. The
modals, with `react-hook-form` and `zod`, are loaded on first open via
`next/dynamic`, keeping them out of the bundle of the majority of visitors who
only scroll.
**Reversal cost.** Low.
