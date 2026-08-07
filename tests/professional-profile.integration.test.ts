import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);

const service = canRun
  ? createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

let ownerId = '';
let outsiderId = '';
let representativeId = '';
let owner: SupabaseClient | null = null;
let outsider: SupabaseClient | null = null;
const ownerPassword = `T3st-${randomUUID()}-Aa`;
const outsiderPassword = `T3st-${randomUUID()}-Bb`;
const slug = `profile-${randomUUID()}`;

function profileArgs(overrides: Record<string, string | null> = {}) {
  return {
    p_display_name: 'Nome Profissional Teste',
    p_authorization_id: 'AUTH-PROFILE-TEST',
    p_phone: '+5511988887777',
    p_city: null,
    ...overrides,
  };
}

describe('professional profile RPC (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const ownerEmail = `profile-owner-${randomUUID()}@example.invalid`;
    const outsiderEmail = `profile-outsider-${randomUUID()}@example.invalid`;

    const [ownerResult, outsiderResult] = await Promise.all([
      service!.auth.admin.createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true }),
      service!.auth.admin.createUser({ email: outsiderEmail, password: outsiderPassword, email_confirm: true }),
    ]);
    assert.equal(ownerResult.error, null);
    assert.equal(outsiderResult.error, null);
    ownerId = ownerResult.data.user!.id;
    outsiderId = outsiderResult.data.user!.id;

    owner = createClient(url!, publicKey!, { auth: { persistSession: false } });
    outsider = createClient(url!, publicKey!, { auth: { persistSession: false } });
    const [ownerSignIn, outsiderSignIn] = await Promise.all([
      owner.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword }),
      outsider.auth.signInWithPassword({ email: outsiderEmail, password: outsiderPassword }),
    ]);
    assert.equal(ownerSignIn.error, null);
    assert.equal(outsiderSignIn.error, null);
  });

  after(async () => {
    if (representativeId) {
      await service!.from('analytics_events').delete().eq('representative_id', representativeId);
      await service!.from('product_activations').delete().eq('representative_id', representativeId);
      await service!.from('subscriptions').delete().eq('representative_id', representativeId);
      await service!.from('representatives').delete().eq('id', representativeId);
    }
    if (ownerId) await service!.auth.admin.deleteUser(ownerId);
    if (outsiderId) await service!.auth.admin.deleteUser(outsiderId);
  });

  it('rejects null, empty and invalid onboarding phones with typed outcomes', async () => {
    for (const [phone, expected] of [[null, 'phone_required'], ['', 'phone_required'], ['invalid', 'phone_invalid']] as const) {
      const { data, error } = await owner!.rpc('register_representative', {
        p_slug: slug,
        p_display_name: 'Nome Inicial Teste',
        p_authorization_id: 'AUTH-ONBOARDING-TEST',
        p_phone: phone,
        p_city: null,
      });
      assert.equal(error, null);
      assert.equal(data?.[0]?.status, expected);
    }
  });

  it('creates a representative only with a valid commercial phone', async () => {
    const { data, error } = await owner!.rpc('register_representative', {
      p_slug: slug,
      p_display_name: 'Nome Inicial Teste',
      p_authorization_id: 'AUTH-ONBOARDING-TEST',
      p_phone: '+5511977776666',
      p_city: null,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'created');
    representativeId = data?.[0]?.representative_id ?? '';
    assert.ok(representativeId);

    const { data: row, error: rowError } = await service!
      .from('representatives')
      .select('phone, display_name, city')
      .eq('id', representativeId)
      .single();
    assert.equal(rowError, null);
    assert.equal(row?.phone, '+5511977776666');
    assert.equal(row?.display_name, 'Nome Inicial Teste');
    assert.equal(row?.city, null);
  });

  it('denies the profile RPC to anon', async () => {
    const anon = createClient(url!, publicKey!);
    const { error } = await anon.rpc('update_representative_profile', profileArgs());
    assert.ok(error);
    assert.match(error.message, /permission denied/i);
  });

  it('derives the target from auth.uid so another authenticated user updates no representative', async () => {
    const { data, error } = await outsider!.rpc('update_representative_profile', profileArgs());
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'representative_not_found');
  });

  it('returns typed rejections without changing the current profile', async () => {
    const cases = [
      [profileArgs({ p_phone: null }), 'phone_required'],
      [profileArgs({ p_phone: '' }), 'phone_required'],
      [profileArgs({ p_phone: 'invalid' }), 'phone_invalid'],
      [profileArgs({ p_display_name: 'Monônimo' }), 'display_name_invalid'],
      [profileArgs({ p_authorization_id: '' }), 'authorization_id_invalid'],
      [profileArgs({ p_city: 'x'.repeat(501) }), 'city_invalid'],
    ] as const;

    for (const [args, expected] of cases) {
      const { data, error } = await owner!.rpc('update_representative_profile', args);
      assert.equal(error, null);
      assert.equal(data?.[0]?.status, expected);
    }

    const { data: row } = await service!
      .from('representatives')
      .select('phone, display_name')
      .eq('id', representativeId)
      .single();
    assert.equal(row?.phone, '+5511977776666');
    assert.equal(row?.display_name, 'Nome Inicial Teste');
  });

  it('persists an edited public name and phone while accepting a null city', async () => {
    const { data, error } = await owner!.rpc('update_representative_profile', profileArgs());
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'updated');

    const { data: row, error: rowError } = await service!
      .from('representatives')
      .select('phone, display_name, authorization_id, city')
      .eq('id', representativeId)
      .single();
    assert.equal(rowError, null);
    assert.deepEqual(row, {
      phone: '+5511988887777',
      display_name: 'Nome Profissional Teste',
      authorization_id: 'AUTH-PROFILE-TEST',
      city: null,
    });
  });

  it('never touches profiles.full_name — representatives.display_name is edited independently (SET-12)', async () => {
    const { data: before, error: beforeError } = await service!
      .from('profiles')
      .select('full_name')
      .eq('id', ownerId)
      .single();
    assert.equal(beforeError, null);

    const { data, error } = await owner!.rpc(
      'update_representative_profile',
      profileArgs({ p_display_name: 'Nome Público Editado De Novo' }),
    );
    assert.equal(error, null);
    assert.equal(data?.[0]?.status, 'updated');

    const { data: representativeRow } = await service!
      .from('representatives')
      .select('display_name')
      .eq('id', representativeId)
      .single();
    assert.equal(representativeRow?.display_name, 'Nome Público Editado De Novo');

    const { data: after, error: afterError } = await service!
      .from('profiles')
      .select('full_name')
      .eq('id', ownerId)
      .single();
    assert.equal(afterError, null);
    assert.equal(after?.full_name, before?.full_name, 'editing the public name must never rewrite the profiles row');
  });

  it('prevents even a privileged direct write from clearing the phone', async () => {
    const { error } = await service!.from('representatives').update({ phone: null }).eq('id', representativeId);
    assert.ok(error);
    assert.match(error.message, /phone is required/i);
  });
});
