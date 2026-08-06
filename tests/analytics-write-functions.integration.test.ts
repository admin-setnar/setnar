import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRunPublic = Boolean(url && publishableKey);
const canRunPrivileged = Boolean(url && publishableKey && serviceRoleKey);
const anon = canRunPublic ? createClient(url!, publishableKey!) : null;
const service = canRunPrivileged
  ? createClient(url!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const rpcArgs = {
  p_representative_slug: `untrusted-${randomUUID()}`,
  p_product_slug: `untrusted-${randomUUID()}`,
  p_referrer: null,
  p_ip_hash: `browser-chosen-${randomUUID()}`,
  p_user_agent: 'Mozilla/5.0',
};

describe('Analytics persistent RPC grants (Postgres, integration)', { skip: !canRunPublic }, () => {
  for (const fn of ['record_page_visit', 'record_whatsapp_click'] as const) {
    it(`denies ${fn} to anon even when the caller chooses ip_hash`, async () => {
      const { error } = await anon!.rpc(fn, rpcArgs);
      assert.ok(error, `${fn} unexpectedly remained callable by anon`);
      assert.match(error.message, /permission denied/i);
    });
  }

  it('denies direct table inserts to anon', async () => {
    const { error } = await anon!.from('analytics_events').insert({
      representative_id: randomUUID(),
      product_id: randomUUID(),
      event_type: 'visit',
      ip_hash: `anon-${randomUUID()}`,
    });
    assert.ok(error);
    assert.match(error.message, /permission denied/i);
  });

  const helperCalls = [
    ['is_page_publicly_accessible', { p_representative_id: randomUUID(), p_product_id: randomUUID() }],
    ['has_publicly_accessible_page', { p_representative_id: randomUUID() }],
    ['page_publication_blocker', { p_representative_id: randomUUID(), p_product_id: randomUUID() }],
  ] as const;
  for (const [fn, args] of helperCalls) {
    it(`does not expose internal helper ${fn} as a public RPC`, async () => {
      const { error } = await anon!.rpc(fn, args);
      assert.ok(error, `${fn} unexpectedly appeared in the public RPC surface`);
      assert.match(error.message, /function|schema cache|could not find/i);
    });
  }
});

let userId: string | null = null;
let email = '';
const password = `T3st-${randomUUID()}-Aa`;
let authenticated: SupabaseClient | null = null;

describe('Analytics authenticated denial (Postgres, integration)', { skip: !canRunPrivileged }, () => {
  before(async () => {
    email = `analytics-grants-${randomUUID()}@example.invalid`;
    const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(error, null);
    userId = data.user?.id ?? null;
    assert.ok(userId);

    authenticated = createClient(url!, publishableKey!, { auth: { persistSession: false } });
    const { error: signInError } = await authenticated.auth.signInWithPassword({ email, password });
    assert.equal(signInError, null);
  });

  after(async () => {
    if (userId) await service!.auth.admin.deleteUser(userId);
  });

  for (const fn of ['record_page_visit', 'record_whatsapp_click'] as const) {
    it(`denies ${fn} to authenticated`, async () => {
      const { error } = await authenticated!.rpc(fn, rpcArgs);
      assert.ok(error, `${fn} unexpectedly remained callable by authenticated`);
      assert.match(error.message, /permission denied/i);
    });
  }


  it('denies direct table inserts to authenticated', async () => {
    const { error } = await authenticated!.from('analytics_events').insert({
      representative_id: randomUUID(),
      product_id: randomUUID(),
      event_type: 'visit',
      ip_hash: `authenticated-${randomUUID()}`,
    });
    assert.ok(error);
    assert.match(error.message, /permission denied/i);
  });

  for (const operation of ['update', 'delete'] as const) {
    it(`denies direct ${operation.toUpperCase()} to authenticated`, async () => {
      const query = authenticated!.from('analytics_events');
      const { error } = operation === 'update'
        ? await query.update({ referrer: 'https://attacker.invalid' }).eq('id', -1)
        : await query.delete().eq('id', -1);
      assert.ok(error, `authenticated unexpectedly retained ${operation.toUpperCase()}`);
      assert.match(error.message, /permission denied/i);
    });
  }
});

describe('Analytics trusted backend path (Postgres, integration)', { skip: !canRunPrivileged }, () => {
  it('allows service_role to persist for a currently public pair', async (t) => {
    const { data: activations, error: activationError } = await service!
      .from('product_activations')
      .select('representative:representatives!inner(slug), product:products!inner(slug)')
      .eq('status', 'published')
      .limit(20);
    assert.equal(activationError, null);

    let insertedEventId: number | null = null;
    for (const row of activations ?? []) {
      const representative = row.representative as unknown as { slug: string } | null;
      const product = row.product as unknown as { slug: string } | null;
      if (!representative || !product) continue;
      const ipHash = `backend-hash-${randomUUID()}`;
      const { data: accepted, error } = await service!.rpc('record_page_visit', {
        p_representative_slug: representative.slug,
        p_product_slug: product.slug,
        p_referrer: 'https://example.invalid/trusted-backend-test',
        p_ip_hash: ipHash,
        p_user_agent: 'Mozilla/5.0',
      });
      assert.equal(error, null);
      if (accepted === true) {
        const { data: event, error: eventError } = await service!
          .from('analytics_events')
          .select('id')
          .eq('ip_hash', ipHash)
          .single();
        assert.equal(eventError, null);
        insertedEventId = event?.id ?? null;
        break;
      }
    }

    if (insertedEventId === null) {
      t.skip('No currently publicly accessible fixture exists in the configured project.');
      return;
    }

    const { error: cleanupError } = await service!.from('analytics_events').delete().eq('id', insertedEventId);
    assert.equal(cleanupError, null);
  });
});
