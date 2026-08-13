import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Integration tests for the final `submit_lead` contract. Browser roles are
 * denied before the function body runs; trusted backend calls retain the
 * fixed rate limit, validation and anti-enumeration return; concurrent calls
 * against one bucket are serialized in Postgres.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRunPublic = Boolean(SUPABASE_URL && SUPABASE_KEY);
const canRunPrivileged = Boolean(SUPABASE_URL && SUPABASE_KEY && SERVICE_ROLE_KEY);
const skipReason =
  'Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY, with all migrations applied, to run this suite.';

type ValidPair = { representativeId: string; productId: string };
const generatedIpHashes = new Set<string>();

function freshIpHash(label: string): string {
  const ipHash = `lead-submission-test-${label}-${randomUUID()}`;
  generatedIpHashes.add(ipHash);
  return ipHash;
}

const anon = canRunPublic ? createClient(SUPABASE_URL!, SUPABASE_KEY!) : null;
const service = canRunPrivileged
  ? createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;
let fixtureUserId = '';
let fixtureRepresentativeId = '';
let fixtureActivationId = '';
let fixtureSubscriptionId = '';
let fixturePair: ValidPair | null = null;

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
  client: SupabaseClient,
  args: Record<string, unknown>,
): Promise<{ data: boolean | null; error: PostgrestError | null }> {
  const { data, error } = await client.rpc('submit_lead', args);
  return { data: data as boolean | null, error };
}

function validArgs(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    p_representative_id: randomUUID(),
    p_product_id: randomUUID(),
    p_telefone_e164: '+5511988887777',
    p_nome: 'Lead Teste',
    p_cidade: null,
    p_email: null,
    p_origem: 'lead-submission-integration-test',
    p_referrer: null,
    p_ip_hash: freshIpHash('default'),
    ...overrides,
  };
}

describe('submit_lead browser-role denial (Postgres, integration)', { skip: !canRunPublic }, () => {
  it('denies anon before a caller-chosen hash can select a bucket', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await submitLead(anon!, validArgs({ p_ip_hash: freshIpHash(`anon-${attempt}`) }));
      assert.ok(error, 'anon unexpectedly invoked submit_lead');
      assert.match(error.message, /permission denied/i);
    }
  });
});

let userId: string | null = null;
let authenticated: SupabaseClient | null = null;
const authenticatedPassword = `T3st-${randomUUID()}-Aa`;

describe('submit_lead authenticated denial (Postgres, integration)', { skip: !canRunPrivileged }, () => {
  before(async () => {
    const email = `lead-grants-${randomUUID()}@example.invalid`;
    const { data, error } = await service!.auth.admin.createUser({
      email,
      password: authenticatedPassword,
      email_confirm: true,
    });
    assert.equal(error, null);
    userId = data.user?.id ?? null;
    assert.ok(userId);

    authenticated = createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await authenticated.auth.signInWithPassword({
      email,
      password: authenticatedPassword,
    });
    assert.equal(signInError, null);
  });

  after(async () => {
    if (userId) await service!.auth.admin.deleteUser(userId);
  });

  it('denies authenticated before a caller-chosen hash can select a bucket', async () => {
    const { error } = await submitLead(authenticated!, validArgs({ p_ip_hash: freshIpHash('authenticated') }));
    assert.ok(error, 'authenticated unexpectedly invoked submit_lead');
    assert.match(error.message, /permission denied/i);
  });
});

describe('submit_lead trusted backend RPC (Postgres, integration)', { skip: !canRunPrivileged && skipReason }, () => {
  before(async () => {
    const { data: product, error: productError } = await service!
      .from('products')
      .select('id, company_id')
      .limit(1)
      .single();
    assert.equal(productError, null);

    const { data: userData, error: userError } = await service!.auth.admin.createUser({
      email: `lead-submission-fixture-${randomUUID()}@example.invalid`,
      password: `T3st-${randomUUID()}-Aa`,
      email_confirm: true,
    });
    assert.equal(userError, null);
    fixtureUserId = userData.user!.id;

    const { data: representative, error: representativeError } = await service!
      .from('representatives')
      .insert({
        profile_id: fixtureUserId,
        company_id: product!.company_id,
        slug: `lead-submission-fixture-${randomUUID()}`,
        display_name: 'Fixture Lead Submission',
        authorization_id: `test-${randomUUID()}`,
        phone: '+5511988887777',
        status: 'active',
      })
      .select('id')
      .single();
    assert.equal(representativeError, null);
    fixtureRepresentativeId = representative!.id;

    const { data: subscription, error: subscriptionError } = await service!
      .from('subscriptions')
      .insert({ representative_id: fixtureRepresentativeId, status: 'active', provider: 'test' })
      .select('id')
      .single();
    assert.equal(subscriptionError, null);
    fixtureSubscriptionId = subscription!.id;

    const { data: activation, error: activationError } = await service!
      .from('product_activations')
      .insert({
        representative_id: fixtureRepresentativeId,
        product_id: product!.id,
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    assert.equal(activationError, null);
    fixtureActivationId = activation!.id;
    fixturePair = { representativeId: fixtureRepresentativeId, productId: product!.id };
  });

  after(async () => {
    const cleanupErrors: string[] = [];
    const recordError = (label: string, error: { message: string } | null) => {
      if (error) cleanupErrors.push(`${label}: ${error.message}`);
    };

    if (fixtureRepresentativeId) {
      recordError(
        'leads',
        (await service!.from('leads').delete().eq('representative_id', fixtureRepresentativeId)).error,
      );
    }
    if (generatedIpHashes.size) {
      recordError(
        'lead submission attempts',
        (await service!.from('lead_submission_attempts').delete().in('ip_hash', [...generatedIpHashes])).error,
      );
    }
    if (fixtureActivationId) {
      recordError(
        'product activation',
        (await service!.from('product_activations').delete().eq('id', fixtureActivationId)).error,
      );
    }
    if (fixtureSubscriptionId) {
      recordError(
        'subscription',
        (await service!.from('subscriptions').delete().eq('id', fixtureSubscriptionId)).error,
      );
    }
    if (fixtureRepresentativeId) {
      recordError(
        'representative',
        (await service!.from('representatives').delete().eq('id', fixtureRepresentativeId)).error,
      );
    }
    if (fixtureUserId) {
      recordError('auth user', (await service!.auth.admin.deleteUser(fixtureUserId)).error);
    }

    if (fixtureRepresentativeId) {
      const { count: remainingLeads, error: remainingLeadsError } = await service!
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('representative_id', fixtureRepresentativeId);
      recordError('lead cleanup verification', remainingLeadsError);
      assert.equal(remainingLeads, 0, 'the fixture representative must retain no leads');

      const { count: remainingRepresentative, error: remainingRepresentativeError } = await service!
        .from('representatives')
        .select('id', { count: 'exact', head: true })
        .eq('id', fixtureRepresentativeId);
      recordError('representative cleanup verification', remainingRepresentativeError);
      assert.equal(remainingRepresentative, 0, 'the fixture representative must be removed');
    }
    if (generatedIpHashes.size) {
      const { count: remainingAttempts, error: remainingAttemptsError } = await service!
        .from('lead_submission_attempts')
        .select('id', { count: 'exact', head: true })
        .in('ip_hash', [...generatedIpHashes]);
      recordError('attempt cleanup verification', remainingAttemptsError);
      assert.equal(remainingAttempts, 0, 'the generated rate-limit buckets must be removed');
    }

    assert.deepEqual(cleanupErrors, [], 'the disposable lead fixture must be fully removed');
  });

  it('rejects the pre-fix call shape outright: p_max_attempts_ip / p_window_seconds no longer exist', async () => {
    const { error } = await submitLead(service!, {
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
    const { data, error } = await submitLead(service!, {
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

  it('enforces the fixed 5-per-hour limit and cannot be raised by the caller: the 6th call from one origin is rejected', async () => {
    const pair = fixturePair!;

    const ipHash = freshIpHash('rate-limit');
    const results: boolean[] = [];

    for (let i = 0; i < 6; i++) {
      const { data, error } = await submitLead(service!, {
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

  it('serializes concurrent calls so at most 5 submissions enter one bucket', async () => {
    const pair = fixturePair!;

    const ipHash = freshIpHash('concurrent-rate-limit');
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => submitLead(service!, {
        p_representative_id: pair.representativeId,
        p_product_id: pair.productId,
        p_telefone_e164: '+5511988887777',
        p_nome: `Lead Concorrente ${index}`,
        p_cidade: null,
        p_email: null,
        p_origem: 'lead-submission-concurrency-test',
        p_referrer: null,
        p_ip_hash: ipHash,
      })),
    );

    for (const result of results) assert.equal(result.error, null);
    assert.equal(results.filter((result) => result.data === true).length, 5);
    assert.equal(results.filter((result) => result.data === false).length, 5);
  });

  it('a fresh origin is unaffected by another origin already at its limit', async () => {
    const pair = fixturePair!;

    const exhaustedIp = freshIpHash('exhausted-origin');
    for (let i = 0; i < 5; i++) {
      await submitLead(service!, {
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

    const { data, error } = await submitLead(service!, {
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

  it('a well-formed submission is accepted (happy path)', async () => {
    const pair = fixturePair!;

    const { data, error } = await submitLead(service!, {
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

  it('rejects a malformed phone number at the SQL level, even with a valid pair (defense in depth, bypasses leadSubmissionSchema)', async () => {
    const pair = fixturePair!;

    const { data, error } = await submitLead(service!, {
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

  it('rejects a malformed email at the SQL level, even with a valid pair', async () => {
    const pair = fixturePair!;

    const { data, error } = await submitLead(service!, {
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

  it('rejects an oversized name at the SQL level, even with a valid pair', async () => {
    const pair = fixturePair!;

    const { data, error } = await submitLead(service!, {
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
