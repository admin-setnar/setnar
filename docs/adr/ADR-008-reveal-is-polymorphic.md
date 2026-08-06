### ADR-008 — `Reveal` is polymorphic
**Decision.** The scroll-reveal wrapper takes an `as` prop and renders `<li>`
directly inside lists.
**Why.** It originally rendered a `<div>` between `<ol>` and `<li>`, which
silently destroys list semantics — a screen reader stops announcing "item 1 of
3". Caught by Lighthouse, not by review. A wrapper component must never change
the semantics of what it wraps.
**Reversal cost.** None.
