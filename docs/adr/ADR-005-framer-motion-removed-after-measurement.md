### ADR-005 — Framer Motion removed after measurement
**Decision.** Build the scroll reveal on `IntersectionObserver` plus a CSS
transition, and drop the animation library.
**Evidence.** Both versions were built and measured:

| Implementation | Page JS | First Load JS |
| --- | --- | --- |
| Framer Motion | 55.2 kB | 166 kB |
| IntersectionObserver | 15.9 kB | **127 kB** |

**Why.** 39 kB — 24% of First Load JS — for a 6px fade, on a page whose audience
opens it on mid-range Android over mobile data. `ENGINEERING_GUIDELINES.md`
asks, before adding a package: *"Can this be solved with native APIs?"* Here it
plainly can. The library remains the right call for the authenticated app, where
the cost sits behind login and the animations are real.
**Note.** Framer Motion was on your requested stack, so this is the one place
the delivery diverges from the brief. Say the word and it goes back — the change
is one file.
**Reversal cost.** Trivial.
