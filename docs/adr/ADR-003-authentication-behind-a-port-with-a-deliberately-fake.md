### ADR-003 — Authentication behind a port, with a deliberately fake adapter
**Decision.** `AuthGateway` is a domain port. `MockAuthGateway` is the only
implementation today, and it has deterministic triggers:

| Input | Result |
| --- | --- |
| `senha-invalida@setnar.com` (sign in) | `invalid_credentials` |
| `bloqueado@setnar.com` (sign in) | `rate_limited` |
| `existente@setnar.com` (sign up) | `email_already_registered` |
| any social provider | `provider_unavailable` |
| anything else | success |

**Why.** Every state — idle, submitting, failed, succeeded — is buildable,
reviewable and testable before a backend exists. Failure codes are
provider-agnostic, so the UI never parses a vendor's error strings.
**Status: migrated (Sprint A).** `getAuthGateway()` now returns
`SupabaseAuthGateway`. `MockAuthGateway` stays in the repo for the test
suite, but nothing in `app/` or `presentation/` reaches it any more —
`no-restricted-imports` enforces that. See ADR-011 through ADR-013 for what
the migration itself required. As predicted here, no structural refactor of
`AuthGateway`, the use cases, or their call sites was needed.
**Reversal cost.** Low.
