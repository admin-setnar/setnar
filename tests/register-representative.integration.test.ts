import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import { createClient } from '@supabase/supabase-js';

/**
 * Integration coverage for `register_representative`
 * (`supabase/migrations/20260806000000_add_register_representative.sql`).
 *
 * Automates ONLY the anonymous-rejection path — strategy (c) from the D3.B.1
 * investigation, approved before this migration was written. The function's
 * entire reason to exist is authenticated (`grant execute ... to
 * authenticated`, never `anon`; the core "already have a representative"
 * check is against `auth.uid()`), so the real behaviour (happy path, slug
 * collision, reserved-word rejection, double-submit under one account) can't
 * be exercised without a real signed-in session. Unlike
 * `rls-policy-cycle.integration.test.ts` (which could stay anonymous-only
 * because that bug fires at policy-expansion time, before `auth.uid()` even
 * matters), there is no anonymous version of this function's real behaviour
 * to test — only automating what's actually reachable without a session:
 * confirming the function is NOT callable by `anon` at all.
 *
 * Without a service role key (this project has none — see
 * `supabase/README.md`), there is no way to create a disposable `auth.users`
 * row here and clean it up afterward — `representatives` has no DELETE
 * policy either (only SELECT policies exist, ADR-038), so even the row this
 * function creates could never be removed through the publishable key. That
 * cost — one permanent row per CI run, competing for the shared 500/hour
 * Supabase Auth rate limit documented in `supabase/README.md` §4 — is why
 * the authenticated path is a MANUAL checklist (`supabase/README.md`, passo
 * 10) instead of automated here. See that section for what this suite does
 * NOT cover, listed exhaustively.
 *
 * Same self-skipping posture as the other integration suites: green on a
 * machine with no Supabase project (ADR-017), with `npm run test:integration`
 * turning that skip into a loud failure for `npm run verify`/CI.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const canRun = Boolean(SUPABASE_URL && SUPABASE_KEY);
const skipReason =
  'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, with the migration already applied, to run this suite.';

const supabase = canRun ? createClient(SUPABASE_URL!, SUPABASE_KEY!) : null;

describe('register_representative RPC (Postgres, integration)', { skip: !canRun && skipReason }, () => {
  it('rejects an anonymous caller outright: the function is granted to authenticated only, never anon', async () => {
    // No session on this client at all — the publishable key alone, exactly
    // what any holder of it can do without ever signing in.
    const { data, error } = await supabase!.rpc('register_representative', {
      p_slug: `register-representative-anon-test-${randomUUID()}`,
      p_display_name: 'Anon Teste Sobrenome',
      p_authorization_id: 'ANON-TEST-ID',
      p_phone: null,
      p_city: null,
    });
    assert.ok(
      error,
      'an anonymous call must be rejected — register_representative was never granted to anon ' +
        '(see 20260806000000\'s header for why: auth.uid() would be null, and the INSERT would hit ' +
        'the not-null violation on representatives.profile_id instead of a typed result)',
    );
    // PGRST202 is PostgREST's "no function with this name/signature exists in
    // the schema cache" — it means 20260806000000 has not been applied to
    // the configured project at all. Accepting ANY error here would let this
    // test pass for the wrong reason (migration missing) instead of the
    // right one (migration applied, grant correctly excludes anon) — the
    // exact false-positive this assertion exists to rule out.
    assert.notEqual(
      error?.code,
      'PGRST202',
      'register_representative was not found in the schema cache — this means ' +
        '20260806000000_add_register_representative.sql has not been applied to the configured ' +
        'Supabase project yet. Apply it via the SQL Editor (supabase/README.md, passo 10) before ' +
        'this suite can prove anything about the anon/authenticated grant boundary.',
    );
    assert.equal(data, null, 'no row should ever be created by an unauthenticated call');
  });
});

describe('register_representative RPC — controls', { skip: !canRun && skipReason }, () => {
  it('reads the seeded catalog, proving the key and project are reachable', async () => {
    // If this fails too, the suite above is failing for some reason other
    // than the missing anon grant — same control shape as
    // rls-policy-cycle.integration.test.ts.
    const { data, error } = await supabase!.from('products').select('slug');
    assert.equal(error, null, `products: unexpected error ${error?.code}: ${error?.message}`);
    assert.ok((data?.length ?? 0) > 0, 'expected the D1 catalog seed to be applied');
  });

  it('confirms is_own_representative (also security definer, but granted to anon) IS callable without a session', async () => {
    // Contrast case: proves the rejection above is specifically about the
    // missing anon grant on THIS function, not about RPC calls being broken
    // for anonymous clients in general.
    const { error } = await supabase!.rpc('is_own_representative', {
      p_representative_id: randomUUID(),
    });
    assert.equal(error, null, `is_own_representative: unexpected error ${error?.code}: ${error?.message}`);
  });
});
