### ADR-009 — `--content-subtle` decoupled from the brand palette
**Decision.** The subtle text token is `90 99 114` rather than the identity's
`#6B7280`.
**Why.** `#6B7280` cleared AA against the sunken surface by 0.12 — technically a
pass, no margin at all. Any tenant shifting its palette would have pushed it
under. It now clears by 1.3. The identity's grey remains available as
`--palette-500` for non-text use.
**Reversal cost.** One token.
