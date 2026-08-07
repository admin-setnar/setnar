import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * SET-60/SET-61: `record_feedback_shown`/`resolve_feedback`
 * (`supabase/migrations/20260822000000_add_feedback_responses.sql`) against
 * a real Postgres project. `first_publication`'s `easy`/`reasonable`/
 * `difficult` vocabulary doubles as SET-61's own RPC-level proof — those are
 * exactly the values `FeedbackPrompt` sends for "Como foi criar sua
 * página?". `value_perception`/`pmf` are exercised only to prove the shared
 * infrastructure's `response` contract is not structurally pinned to
 * SET-61's vocabulary (no SET-62/64 flow is implemented here).
 * `cancellation` is exercised only to prove no taxonomy was guessed ahead
 * of SET-63.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);

const service = canRun
  ? createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

let ownerId = '';
let outsiderId = '';
let ownerRepresentativeId = '';
let owner: SupabaseClient | null = null;
let outsider: SupabaseClient | null = null;
const ownerPassword = `T3st-${randomUUID()}-Aa`;
const outsiderPassword = `T3st-${randomUUID()}-Bb`;

async function createRepresentative(label: string, password: string): Promise<{ userId: string; client: SupabaseClient; representativeId: string }> {
  const email = `feedback-${label}-${randomUUID()}@example.invalid`;
  const { data: userData, error: userError } = await service!.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(userError, null);
  const userId = userData.user!.id;

  const { data: product } = await service!.from('products').select('company_id').limit(1).single();

  const { data: representative, error: repError } = await service!
    .from('representatives')
    .insert({
      profile_id: userId,
      company_id: product!.company_id,
      slug: `feedback-${label}-${randomUUID()}`,
      display_name: `Teste Feedback ${label}`,
      authorization_id: `test-${randomUUID()}`,
      phone: '+5511999999999',
      status: 'active',
    })
    .select('id')
    .single();
  assert.equal(repError, null);

  const client = createClient(url!, publicKey!, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  assert.equal(signInError, null);

  return { userId, client, representativeId: representative!.id };
}

describe('feedback_responses RPCs (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const ownerFixture = await createRepresentative('owner', ownerPassword);
    ownerId = ownerFixture.userId;
    owner = ownerFixture.client;
    ownerRepresentativeId = ownerFixture.representativeId;

    const outsiderFixture = await createRepresentative('outsider', outsiderPassword);
    outsiderId = outsiderFixture.userId;
    outsider = outsiderFixture.client;
  });

  after(async () => {
    if (ownerRepresentativeId) {
      await service!.from('feedback_responses').delete().eq('representative_id', ownerRepresentativeId);
      await service!.from('representatives').delete().eq('id', ownerRepresentativeId);
    }
    if (ownerId) await service!.auth.admin.deleteUser(ownerId);
    if (outsiderId) {
      // The outsider's own representative row cascades with it; delete the user only.
      await service!.auth.admin.deleteUser(outsiderId);
    }
  });

  it('denies both RPCs to an anonymous caller', async () => {
    const anon = createClient(url!, publicKey!);
    const shown = await anon.rpc('record_feedback_shown', { p_context: 'first_publication' });
    assert.ok(shown.error);
    assert.match(shown.error!.message, /permission denied/i);

    const resolved = await anon.rpc('resolve_feedback', {
      p_context: 'first_publication',
      p_outcome: 'answered',
      p_response: 'easy',
      p_response_detail: null,
    });
    assert.ok(resolved.error);
    assert.match(resolved.error!.message, /permission denied/i);
  });

  it('rejects resolving a context that was never shown', async () => {
    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'value_perception',
      p_outcome: 'answered',
      p_response: null,
      p_response_detail: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'not_shown');
  });

  it('records shown, then resolves with an answer — full happy path for "easy"', async () => {
    const { data: shown, error: shownError } = await owner!.rpc('record_feedback_shown', {
      p_context: 'first_publication',
    });
    assert.equal(shownError, null);
    const rowId = shown?.[0]?.id;
    assert.ok(rowId, 'record_feedback_shown must return the row id');

    const { data: row } = await service!.from('feedback_responses').select('shown_at, answered_at, dismissed_at').eq('id', rowId).single();
    assert.ok(row?.shown_at);
    assert.equal(row?.answered_at, null);
    assert.equal(row?.dismissed_at, null);

    const { data: resolved, error: resolveError } = await owner!.rpc('resolve_feedback', {
      p_context: 'first_publication',
      p_outcome: 'answered',
      p_response: 'easy',
      p_response_detail: null,
    });
    assert.equal(resolveError, null);
    assert.equal(resolved?.[0]?.status, 'updated');

    const { data: resolvedRow } = await service!
      .from('feedback_responses')
      .select('answered_at, dismissed_at, response, response_detail')
      .eq('id', rowId)
      .single();
    assert.ok(resolvedRow?.answered_at);
    assert.equal(resolvedRow?.dismissed_at, null);
    assert.equal(resolvedRow?.response, 'easy');
    assert.equal(resolvedRow?.response_detail, null);
  });

  it('rejects resolving the same context twice — already answered', async () => {
    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'first_publication',
      p_outcome: 'dismissed',
      p_response: null,
      p_response_detail: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'already_resolved');
  });

  it('never shows the same context twice: record_feedback_shown reuses the resolved row instead of creating a new one', async () => {
    const { data: firstCall } = await owner!.rpc('record_feedback_shown', { p_context: 'first_publication' });
    const { data: secondCall } = await owner!.rpc('record_feedback_shown', { p_context: 'first_publication' });
    assert.equal(firstCall?.[0]?.id, secondCall?.[0]?.id);
  });

  it('records a "difficult" answer (first_publication\'s own vocabulary) together with an optional detail', async () => {
    await service!.from('feedback_responses').delete().eq('representative_id', ownerRepresentativeId).eq('context', 'first_publication');
    const { data: shown } = await owner!.rpc('record_feedback_shown', { p_context: 'first_publication' });
    const rowId = shown?.[0]?.id;

    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'first_publication',
      p_outcome: 'answered',
      p_response: 'difficult',
      p_response_detail: 'O passo de autorização não ficou claro.',
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'updated');

    const { data: row } = await service!
      .from('feedback_responses')
      .select('response, response_detail')
      .eq('id', rowId)
      .single();
    assert.equal(row?.response, 'difficult');
    assert.equal(row?.response_detail, 'O passo de autorização não ficou claro.');
  });

  it('dismisses a shown context without recording a response, and permanently blocks resolving that same row again', async () => {
    const { data: shown } = await owner!.rpc('record_feedback_shown', { p_context: 'pmf' });
    const rowId = shown?.[0]?.id;

    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'pmf',
      p_outcome: 'dismissed',
      p_response: null,
      p_response_detail: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'updated');

    const { data: row } = await service!
      .from('feedback_responses')
      .select('answered_at, dismissed_at, response')
      .eq('id', rowId)
      .single();
    assert.equal(row?.answered_at, null);
    assert.ok(row?.dismissed_at);
    assert.equal(row?.response, null);

    // A data-integrity guard, not the presentation-layer's re-exposure
    // policy: the same row cannot be settled a second time by either
    // outcome, whether the caller retries a dismiss or attempts an answer.
    const { data: retryDismiss } = await owner!.rpc('resolve_feedback', {
      p_context: 'pmf',
      p_outcome: 'dismissed',
      p_response: null,
      p_response_detail: null,
    });
    assert.equal(retryDismiss?.[0]?.status, 'already_resolved');

    const { data: retryAnswer } = await owner!.rpc('resolve_feedback', {
      p_context: 'pmf',
      p_outcome: 'answered',
      p_response: 'very_disappointed',
      p_response_detail: null,
    });
    assert.equal(retryAnswer?.[0]?.status, 'already_resolved');
  });

  it('record_feedback_shown is idempotent before any resolution: repeated calls return the same row, never a duplicate', async () => {
    const { data: first } = await owner!.rpc('record_feedback_shown', { p_context: 'value_perception' });
    const { data: second } = await owner!.rpc('record_feedback_shown', { p_context: 'value_perception' });
    const { data: third } = await owner!.rpc('record_feedback_shown', { p_context: 'value_perception' });
    assert.ok(first?.[0]?.id);
    assert.equal(first?.[0]?.id, second?.[0]?.id);
    assert.equal(first?.[0]?.id, third?.[0]?.id);

    const { data: rows } = await service!
      .from('feedback_responses')
      .select('id')
      .eq('representative_id', ownerRepresentativeId)
      .eq('context', 'value_perception');
    assert.equal(rows?.length, 1);
  });

  it('accepts value_perception\'s own response vocabulary ("yes")', async () => {
    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'value_perception',
      p_outcome: 'answered',
      p_response: 'yes',
      p_response_detail: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'updated');
  });

  it('accepts pmf\'s own response vocabulary ("very_disappointed") on a fresh row', async () => {
    await service!.from('feedback_responses').delete().eq('representative_id', ownerRepresentativeId).eq('context', 'pmf');
    await owner!.rpc('record_feedback_shown', { p_context: 'pmf' });

    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'pmf',
      p_outcome: 'answered',
      p_response: 'very_disappointed',
      p_response_detail: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'updated');
  });

  it('rejects a response from another context\'s vocabulary — the DB does not structurally block value_perception/pmf codes, but a context cannot answer with a code that is not its own', async () => {
    await service!.from('feedback_responses').delete().eq('representative_id', ownerRepresentativeId).eq('context', 'first_publication');
    const { data: shown } = await owner!.rpc('record_feedback_shown', { p_context: 'first_publication' });
    const rowId = shown?.[0]?.id;

    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'first_publication',
      p_outcome: 'answered',
      p_response: 'yes', // valid for value_perception, not for first_publication
      p_response_detail: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'invalid_response');

    const { data: row } = await service!
      .from('feedback_responses')
      .select('answered_at, response')
      .eq('id', rowId)
      .single();
    assert.equal(row?.answered_at, null, 'a rejected response must not settle the row');
    assert.equal(row?.response, null);
  });

  it('rejects first_publication\'s vocabulary on value_perception', async () => {
    await service!.from('feedback_responses').delete().eq('representative_id', ownerRepresentativeId).eq('context', 'value_perception');
    await owner!.rpc('record_feedback_shown', { p_context: 'value_perception' });

    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'value_perception',
      p_outcome: 'answered',
      p_response: 'difficult', // valid for first_publication, not for value_perception
      p_response_detail: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'invalid_response');
  });

  it('rejects an empty response on "answered"', async () => {
    await owner!.rpc('record_feedback_shown', { p_context: 'cancellation' });
    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'cancellation',
      p_outcome: 'answered',
      p_response: '   ',
      p_response_detail: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'response_required');
  });

  it('rejects an unrecognised outcome', async () => {
    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'cancellation',
      p_outcome: 'maybe',
      p_response: null,
      p_response_detail: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'invalid_outcome');
  });

  it('rejects any answered response for cancellation — SET-63 has not approved a taxonomy yet, so nothing is guessed here', async () => {
    const { data, error } = await owner!.rpc('resolve_feedback', {
      p_context: 'cancellation',
      p_outcome: 'answered',
      p_response: 'anything',
      p_response_detail: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'invalid_response');
  });

  it('rejects a response_detail over the 140-character limit at the SQL level', async () => {
    await service!.from('feedback_responses').delete().eq('representative_id', ownerRepresentativeId).eq('context', 'first_publication');
    await owner!.rpc('record_feedback_shown', { p_context: 'first_publication' });

    const { error } = await owner!.rpc('resolve_feedback', {
      p_context: 'first_publication',
      p_outcome: 'answered',
      p_response: 'difficult',
      p_response_detail: 'x'.repeat(141),
    });
    assert.ok(error, 'a response_detail over 140 characters must be rejected, not silently truncated');
  });

  it('never lets one representative read or resolve another representative\'s feedback row', async () => {
    await service!.from('feedback_responses').delete().eq('representative_id', ownerRepresentativeId).eq('context', 'first_publication');
    const { data: shown } = await owner!.rpc('record_feedback_shown', { p_context: 'first_publication' });
    const ownerRowId = shown?.[0]?.id;
    assert.ok(ownerRowId);

    // Outsider reading feedback_responses at all sees nothing of the owner's.
    const { data: outsiderView, error: outsiderReadError } = await outsider!
      .from('feedback_responses')
      .select('id')
      .eq('id', ownerRowId);
    assert.equal(outsiderReadError, null);
    assert.equal(outsiderView?.length, 0);

    // Outsider resolving the same context resolves THEIR OWN (nonexistent) row, never the owner's.
    const { data: outsiderResolve } = await outsider!.rpc('resolve_feedback', {
      p_context: 'first_publication',
      p_outcome: 'dismissed',
      p_response: null,
      p_response_detail: null,
    });
    assert.equal(outsiderResolve?.[0]?.status, 'not_shown');

    const { data: ownerRowStillUnresolved } = await service!
      .from('feedback_responses')
      .select('answered_at, dismissed_at')
      .eq('id', ownerRowId)
      .single();
    assert.equal(ownerRowStillUnresolved?.answered_at, null);
    assert.equal(ownerRowStillUnresolved?.dismissed_at, null);
  });
});
