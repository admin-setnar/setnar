### ADR-013 — No IP forwarded to Supabase's own rate limiting
**Decision.** Nothing forwards the visitor's IP to the Supabase Auth API.
**Why not, even though it looks like the obvious hardening step.** GoTrue
reads the visitor IP from `Sb-Forwarded-For`, not the generic
`x-forwarded-for` — and honouring that header at all requires a secret API
key, which this project does not hold this sprint. Sending
`x-forwarded-for` anyway would have been silently ignored: worse than doing
nothing, because it would read in code review as a protection that does not
exist.
**Consequence.** Every request from this app reaches Supabase carrying the
IP of whichever Vercel function handled it, not the visitor's — so
Supabase's own native rate limiting (Authentication → Rate Limits) currently
sees all of SETNAR's traffic as one origin. This makes `login_attempts`
(ADR-012) the primary defence against credential stuffing through the app,
not a second layer behind Supabase's own.
**Revisit when:** legitimate users start getting HTTP 429 from Supabase
during ordinary traffic (the shared-bucket symptom), or when the project
takes on a secret API key for another reason. Two fixes exist for whenever
that happens: request a secret key scoped only to setting
`Sb-Forwarded-For`, or move the `signInWithPassword`/`signUp` calls to run in
the browser instead of a Server Action, so Supabase sees the real IP without
any forwarding at all.
**Reversal cost.** Low once a secret key is available — one header on one
client construction call.
