### ADR-017 — The test script now loads `.env.local`, with Node's own flag
**Decision.** `"test"` in `package.json` changed from
`npx tsx --test tests/**/*.test.ts` to
`node --env-file-if-exists=.env.local node_modules/tsx/dist/cli.mjs --test tests/**/*.test.ts`.
**Why this was silently broken before.** Neither `tsx` nor Node's default
module loader reads `.env.local` on its own — confirmed by running an
isolated probe test from this repo's root (which already has a filled-in
`.env.local`) and observing `process.env.NEXT_PUBLIC_SUPABASE_URL` come back
`undefined` inside the old script. The practical effect: the four
integration tests in `tests/login-rate-limiter.integration.test.ts`
self-skip whenever their `canRun` check finds those variables missing (see
that file's own comment) — which was, silently, every single run of
`npm run test`/`npm run verify` on a machine with a real `.env.local`,
because the variables never reached `process.env` in the first place. The
"23/23 passing" this README's Verification status table recorded already
included those 4 as skipped, not run.
**Why `--env-file-if-exists` and not `--env-file`.** `--env-file` errors out
when the file is missing; `--env-file-if-exists` does not. `npm run test`
must stay green on a machine with no Supabase project configured yet — the
same requirement the integration test file's own skip logic already states.
**Why `node_modules/tsx/dist/cli.mjs` and not `npx tsx` or `node_modules/.bin/tsx`.**
Confirmed by trying it directly: on this project's Windows dev machine,
`node_modules/.bin/tsx` is a POSIX `#!/bin/sh` shim (with separate `.cmd`/
`.ps1` siblings for Windows shells) — `node` cannot execute it, since after
its shebang line is stripped what remains is shell syntax, not JavaScript;
it fails with `SyntaxError: missing ) after argument list`. Pointing `node`
directly at tsx's actual entry file works on every platform regardless of
which shim npm generated.
**Consequence, confirmed by re-running the suite.** With the fix in place,
the same 4 integration tests actually ran against the real Supabase project
already configured in this repo's `.env.local` — not skipped — and passed
(1.48 s / 0.19 s / 0.22 s / 1.70 s; real network round trips, not the
sub-millisecond timing of the unit tests around them). This closes one of
the "Not yet verified against a real Supabase project" items this README's
Verification status section listed.
**Reversal cost.** Low — one line in `package.json`; no test file depends on
the loading mechanism itself, only on the variables it makes available.
