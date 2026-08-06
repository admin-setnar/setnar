### ADR-026 — Representative pages resolve by subdomain (`<slug>.<domain>`), not by path — decided before Sprint C, before a single QR code exists
**Decision.** Every representative's commercial page (Sprint C — the page
generator itself is not built yet) will be served on its own subdomain,
e.g. `joao-silva.setnar.com.br`, not on a path under SETNAR's domain
(`setnar.com.br/joao-silva`). Decided now, before the generator exists and
before any representative has a QR code, business card, or WhatsApp bio
link pointing anywhere.
**Alternatives.** Path-based (`setnar.com.br/joao-silva`) is cheaper today —
no wildcard DNS, no wildcard certificate. Rejected for two reasons, in this
order of weight: (1) the cost of changing URL schemes only grows over time
— there is no number of already-distributed QR codes or physical links that
is "safe" to invalidate, so the cheapest moment to decide is before the
first one exists, not after the MVP is validated and the scheme turns out
to need changing; (2) credibility — a URL carrying the representative's own
name before the domain reads as more trustworthy than a path inside SETNAR's
domain, matching the independent-professional audience `PRODUCT.md`
describes (representatives who sell under their own name, not SETNAR's).
Subdomain per representative (chosen) pays the infrastructure cost once,
now, before any physical material depends on the URL shape.
**Consequence.** Requires wildcard DNS (`*.setnar.com.br`) on Vercel plus a
wildcard SSL certificate configured before public launch — pulling the
purchase/configuration of the production domain forward to before launch,
where `ROADMAP.md`'s Stage 5 "White Label → Custom domains" entry had it
planned for after validation. This is a new hard dependency blocking public
launch, not just a preference. It is compatible with — not a new idea
against — that same Stage 5 vision and `DOMAIN_MODEL.md` §827's White Label
note: that entry is a Company's own custom domain (tenant level 1, what
ADR-001 resolves); this decision is a Representative's subdomain nested
inside SETNAR's domain (tenant level 2, one layer inside the Company ADR-001
already resolves). The two are independent and both hold.
**Reversal cost.** High, deliberately — unlike ADR-001 (`Low`, because no
physical material depended on that URL), reversing this after launch means
invalidating every QR code, business card, and WhatsApp bio link already
distributed by licensed representatives. The team accepts that cost
consciously; this is not modeled as cheap to change later.
