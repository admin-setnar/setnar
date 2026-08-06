### ADR-001 — Tenant resolution by `Host` header, in the application layer
**Decision.** Resolve the tenant server-side from `Host`, through a repository
port, with an in-memory adapter.
**Alternatives.** A build-time constant (cheapest, but makes tenant number two a
rebuild); path-based routing like `/t/setnar` (ugly for a product sold on the
strength of its link); middleware (runs on every asset request for no gain).
**Consequence.** `/` renders dynamically rather than statically. Accepted: the
page is small, cached at the edge by the host, and the alternative is a
single-tenant architecture wearing a multi-tenant costume.
**Reversal cost.** Low.
