import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it, type TestContext } from 'node:test';

import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Integration tests for `submit_lead`
 * (`supabase/migrations/20260801000000_add_lead_submission.sql`, fixed by
 * `20260802000000_fix_submit_lead_rate_limit.sql`) — the RPC, not the
 * `/api/leads` route. Same shape as
 * `tests/login-rate-limiter.integration.test.ts`: a real integration suite
 * against the configured Supabase project, self-skipping when it isn't
 * configured, because the logic under test lives in Postgres, not in an
 * importable Node module.
 *
 * Before this file, `modules/leads` had zero automated tests — this is the
 * first coverage for the module, focused on the adversarial scenario that
 * `20260802000000` fixes: a caller reaching `submit_lead` directly (as any
 * holder of the publishable key can, bypassing `/api/leads`'s Zod schema and
 * honeypot entirely) supplying its own rate-limit threshold.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const canRun = Boolean(SUPABASE_URL && SUPABASE_KEY);
const skipReason =
  'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, with the migration already applied, to run this suite.';

function freshIpHash(label: string): string {
  return `lead-submission-test-${label}-${randomUUID()}`;
}

type ValidPair = { representativeId: string; productId: string };

/**
 * `submit_lead` only ever inserts into `leads` for a (representative_id,
 * product_id) pair with a published activation on an active representative
 * — and the anon key cannot create that fixture data itself (`representatives`
 * / `product_activations` have no public INSERT policy, by design; see
 * `supabase/README.md`). So instead of hardcoding IDs from whichever project
 * happens to be configured — fragile across environments, and silently wrong
 * the moment that specific row is ever deleted — this discovers a real pair
 * at run time through the same public SELECT policies
 * (`representatives_select_public` / `product_activations_select_published`,
 * ADR-030) a real Commercial Page relies on. Tests that need real inserts
 * skip themselves (not fail) when no such pair exists in the configured
 * project, the same "don't fail CI on missing environment" posture `canRun`
 * already uses one level up.
 */
async function findPublishedActivation(supabase: SupabaseClient): Promise<ValidPair | null> {
  const { data: representatives } = await supabase.from('representatives').select('id').limit(1);
  const representativeId = representatives?.[0]?.id as string | undefined;
  if (!representativeId) return null;

  const { data: activations } = await supabase
    .from('product_activations')
    .select('product_id')
    .eq('representative_id', representativeId)
    .eq('status', 'published')
    .limit(1);
  const productId = activations?.[0]?.product_id as string | undefined;
  if (!productId) return null;

  return { representativeId, productId };
}

const supabase = canRun ? createClient(SUPABASE_URL!, SUPABASE_KEY!) : null;
const pairSkipReason =
  'No published (representative, product) pair found in the configured Supabase project — ' +
  'these tests cannot provision one with the anon key. Create one manually (see supabase/README.md) to run them.';

/**
 * Looked up lazily (not at module load) and cached — `node:test`'s file
 * loader (via `tsx`) does not support top-level `await`, and a `describe()`
 * `skip` option is evaluated synchronously when `describe()` runs, before
 * any `before()` hook would resolve — so this cannot be a nested describe's
 * static `skip` either. Each test that needs a real pair awaits this and
 * calls `t.skip()` itself when none exists.
 */
let pairLookup: Promise<ValidPair | null> | null = null;
async function requirePair(t: TestContext): Promise<ValidPair | null> {
  if (!supabase) return null;
  pairLookup ??= findPublishedActivation(supabase);
  const pair = await pairLookup;
  if (!pair) {
    t.skip(pairSkipReason);
  }
  return pair;
}

/**
 * Explicit return type, deliberately — destructuring `supabase!.rpc(...)`
 * directly inside a `for` loop (see the rate-limit test below, which calls
 * this 6 times in a row) makes TypeScript report `error` as "implicitly has
 * type 'any' because it does not have a type annotation and is referenced
 * directly or indirectly in its own initializer" (TS7022): a loop-specific
 * control-flow inference quirk against the untyped `SupabaseClient`
 * (no generated `Database` type is wired up in this project). Wrapping the
 * call in a named function with an explicit return type sidesteps it, and
 * also de-duplicates the RPC call across every test below.
 */
async function submitLead(
  args: Record<string, unknown>,
): Promise<{ data: boolean | null; error: PostgrestError | null }> {
  const { data, error } = await supabase!.rpc('submit_lead', args);
  return { data: data as boolean | null, error };
}

describe('submit_lead RPC (Postgres, integration)', { skip: !canRun && skipReason }, () => {
  it('rejects the pre-fix call shape outright: p_max_attempts_ip / p_window_seconds no longer exist', async () => {
    // Before 20260802000000, this exact call — a fresh ip_hash on every
    // attempt is irrelevant here, since the point is that the caller could
    // supply p_window_seconds=1 / p_max_attempts_ip=999999 and defeat the
    // limit outright. After the fix, submit_lead has no 11-parameter
    // overload at all, so PostgREST must fail to resolve the call — a
    // silent success here would mean the vulnerable signature is back.
    const { error } = await submitLead({
      p_representative_id: randomUUID(),
      p_product_id: randomUUID(),
      p_telefone_e164: '+5511988887777',
      p_nome: 'Ataque Teste',
      p_cidade: null,
      p_email: null,
      p_origem: null,
      p_referrer: null,
      p_ip_hash: freshIpHash('old-signature'),
      p_max_attempts_ip: 999_999,
      p_window_seconds: 1,
    });
    assert.ok(
      error,
      'a call using the removed p_max_attempts_ip/p_window_seconds parameters must fail, not silently succeed',
    );
  });

  it('rejects an unknown (representative, product) pair without needing real fixture data', async () => {
    const { data, error } = await submitLead({
      p_representative_id: randomUUID(),
      p_product_id: randomUUID(),
      p_telefone_e164: '+5511988887777',
      p_nome: 'Teste',
      p_cidade: null,
      p_email: null,
      p_origem: null,
      p_referrer: null,
      p_ip_hash: freshIpHash('unknown-pair'),
    });
    assert.equal(error, null);
    assert.equal(data, false);
  });

  it('enforces the fixed 5-per-hour limit and cannot be raised by the caller: the 6th call from one origin is rejected', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const ipHash = freshIpHash('rate-limit');
    const results: boolean[] = [];

    for (let i = 0; i < 6; i++) {
      const { data, error } = await submitLead({
        p_representative_id: pair.representativeId,
        p_product_id: pair.productId,
        p_telefone_e164: '+5511988887777',
        p_nome: `Lead Teste ${i}`,
        p_cidade: null,
        p_email: null,
        p_origem: 'lead-submission-integration-test',
        p_referrer: null,
        p_ip_hash: ipHash,
      });
      assert.equal(error, null);
      results.push(data === true);
    }

    assert.deepEqual(
      results,
      [true, true, true, true, true, false],
      'exactly 5 submissions from one origin must succeed before the 6th is rejected — this is the scenario ' +
        '20260801000000 documented (ADR-034) but did not actually enforce against a direct RPC caller',
    );
  });

  it('a fresh origin is unaffected by another origin already at its limit', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const exhaustedIp = freshIpHash('exhausted-origin');
    for (let i = 0; i < 5; i++) {
      await submitLead({
        p_representative_id: pair.representativeId,
        p_product_id: pair.productId,
        p_telefone_e164: '+5511988887777',
        p_nome: `Lead Teste ${i}`,
        p_cidade: null,
        p_email: null,
        p_origem: 'lead-submission-integration-test',
        p_referrer: null,
        p_ip_hash: exhaustedIp,
      });
    }

    const { data, error } = await submitLead({
      p_representative_id: pair.representativeId,
      p_product_id: pair.productId,
      p_telefone_e164: '+5511988887777',
      p_nome: 'Lead Teste Outra Origem',
      p_cidade: null,
      p_email: null,
      p_origem: 'lead-submission-integration-test',
      p_referrer: null,
      p_ip_hash: freshIpHash('fresh-origin'),
    });
    assert.equal(error, null);
    assert.equal(data, true, 'a different ip_hash must not be blocked by another origin exhausting its own limit');
  });

  it('a well-formed submission is accepted (happy path)', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const { data, error } = await submitLead({
      p_representative_id: pair.representativeId,
      p_product_id: pair.productId,
      p_telefone_e164: '+5511988887777',
      p_nome: 'Lead Teste Happy Path',
      p_cidade: 'São Paulo',
      p_email: 'lead-submission-integration-test@example.invalid',
      p_origem: 'lead-submission-integration-test',
      p_referrer: null,
      p_ip_hash: freshIpHash('happy-path'),
    });
    assert.equal(error, null);
    assert.equal(data, true);
  });

  it('rejects a malformed phone number at the SQL level, even with a valid pair (defense in depth, bypasses leadSubmissionSchema)', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const { data, error } = await submitLead({
      p_representative_id: pair.representativeId,
      p_product_id: pair.productId,
      p_telefone_e164: 'not-a-phone-number',
      p_nome: 'Teste',
      p_cidade: null,
      p_email: null,
      p_origem: 'lead-submission-integration-test',
      p_referrer: null,
      p_ip_hash: freshIpHash('malformed-phone'),
    });
    assert.equal(error, null);
    assert.equal(data, false);
  });

  it('rejects a malformed email at the SQL level, even with a valid pair', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const { data, error } = await submitLead({
      p_representative_id: pair.representativeId,
      p_product_id: pair.productId,
      p_telefone_e164: '+5511988887777',
      p_nome: 'Teste',
      p_cidade: null,
      p_email: 'not-an-email',
      p_origem: 'lead-submission-integration-test',
      p_referrer: null,
      p_ip_hash: freshIpHash('malformed-email'),
    });
    assert.equal(error, null);
    assert.equal(data, false);
  });

  it('rejects an oversized name at the SQL level, even with a valid pair', async (t) => {
    const pair = await requirePair(t);
    if (!pair) return;

    const { data, error } = await submitLead({
      p_representative_id: pair.representativeId,
      p_product_id: pair.productId,
      p_telefone_e164: '+5511988887777',
      p_nome: 'N'.repeat(5000),
      p_cidade: null,
      p_email: null,
      p_origem: 'lead-submission-integration-test',
      p_referrer: null,
      p_ip_hash: freshIpHash('oversized-name'),
    });
    assert.equal(error, null);
    assert.equal(data, false);
  });
});
