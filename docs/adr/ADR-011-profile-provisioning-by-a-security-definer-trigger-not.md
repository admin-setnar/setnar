### ADR-011 — Profile provisioning by a `SECURITY DEFINER` trigger, not a second application call
**Decision.** `auth.signUp()` writes only `full_name` to `raw_user_meta_data`.
A Postgres trigger (`handle_new_user()`) inserts the matching `profiles` row
inside the same transaction as the `auth.users` insert. `tenant_id`,
`terms_accepted_at` and `terms_version` are decided by the trigger itself —
`tenant_id` is a literal, `terms_accepted_at` is `now()`, and `terms_version`
comes from `current_terms_version()`, a second database function that is the
single source of truth for which version of `/termos` and `/privacidade` is
currently in force (no duplicate constant in TypeScript, so a signed consent
record and the copy a user actually saw can never drift apart).
**Alternative rejected.** Two sequential application calls — `auth.signUp()`,
then an insert into `profiles`. Without a service role key, a failure between
the two steps leaves a real auth user with no profile: an orphaned account
with no clean way to detect or repair it from the app layer.
**Why this works without a service role key.** `SECURITY DEFINER` runs the
function as its owner, not as the anonymous caller — the same mechanism RLS
is built on, applied deliberately instead of bypassed. If the insert fails,
Postgres rolls back the entire transaction, including the `auth.users` row:
there is no intermediate state to be orphaned in the first place.
**Reversal cost.** Low — the trigger is one function, dropping it stops
provisioning without touching `SupabaseAuthGateway`.
