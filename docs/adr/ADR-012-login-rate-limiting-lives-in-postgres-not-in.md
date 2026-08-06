### ADR-012 — Login rate limiting lives in Postgres, not in application memory
**Decision.** `is_login_blocked` / `record_login_failure` /
`clear_login_attempts`, three more `SECURITY DEFINER` functions over a
`login_attempts` table with zero RLS policies — the exact same pattern as
ADR-011 — back the rate-limiting rule within a 15-minute window, keyed
independently by a salted SHA-256 hash of the e-mail and of the IP (never
plain text: an attempt log is personal data, and this table exists in the
same sprint that publishes the privacy policy declaring it).
**Why the e-mail and IP thresholds differ (5 vs. 30).** A single shared
threshold was the first version, but it does not fit Brazilian mobile
traffic: CGNAT means many unrelated users can share one public IP, so a
tight per-IP limit blocks innocent users on the same carrier connection, not
just an attacker. The per-e-mail limit stays tight (5) because it has no
such false-positive risk; the per-IP limit is raised (30) to absorb normal
CGNAT sharing while still catching a scan across many accounts from one
origin.
**Alternative rejected, and why it is wrong, not just simpler.** A `Map` in a
module, counting failures in process memory. This app deploys to Vercel,
which is serverless: there is no process that persists between requests, so
a counter kept in one module-level variable can silently reset on every
single request. The dangerous part is that this is invisible locally —
`npm run dev` runs one persistent process, so the bug only appears in
production, with no error and no signal, as a rate limiter that never
actually limits anything.
**Consequence — a limitation, recorded rather than solved.** Without service
role, this table is reachable through the app's Server Actions. Someone who
calls the Supabase API directly with the publishable key (which is public by
design) bypasses this limiter entirely; native Supabase Auth rate limiting is
the only remaining defence against that path — see ADR-013.
**Reversal cost.** Medium. An in-memory limiter becomes viable again only if
the deployment target changes to a host with a persistent process (a
container, not serverless) — until then, this is the only version that
actually enforces the rule in production, not just in `npm run dev`.
