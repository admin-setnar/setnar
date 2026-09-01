import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);

const service = canRun ? createIntegrationServiceRoleClient() : null;

let validUserId = '';
let invalidUserId = '';
let owner: SupabaseClient | null = null;

describe('signup phone profile snapshot (Postgres, integration)', { skip: !canRun }, () => {
  const password = `T3st-${randomUUID()}-Aa`;
  const validPhone = '+5511988887777';

  before(async () => {
    const validEmail = `signup-phone-${randomUUID()}@example.invalid`;
    const invalidEmail = `signup-phone-invalid-${randomUUID()}@example.invalid`;

    const [validResult, invalidResult] = await Promise.all([
      service!.auth.admin.createUser({
        email: validEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Cadastro Telefone', phone: validPhone },
      }),
      service!.auth.admin.createUser({
        email: invalidEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Cadastro Inválido', phone: '11988887777' },
      }),
    ]);

    assert.equal(validResult.error, null);
    assert.equal(invalidResult.error, null);
    validUserId = validResult.data.user!.id;
    invalidUserId = invalidResult.data.user!.id;

    owner = createClient(url!, publicKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await owner.auth.signInWithPassword({
      email: validEmail,
      password,
    });
    assert.equal(signInError, null);
  });

  after(async () => {
    await owner?.auth.signOut();
    if (validUserId) await service!.auth.admin.deleteUser(validUserId);
    if (invalidUserId) await service!.auth.admin.deleteUser(invalidUserId);
  });

  it('copies canonical signup metadata into the owner-readable profile', async () => {
    const { data, error } = await owner!
      .from('profiles')
      .select('full_name, phone')
      .eq('id', validUserId)
      .single();

    assert.equal(error, null);
    assert.deepEqual(data, { full_name: 'Cadastro Telefone', phone: validPhone });
  });

  it('does not copy non-canonical phone metadata into profiles', async () => {
    const { data, error } = await service!
      .from('profiles')
      .select('phone')
      .eq('id', invalidUserId)
      .single();

    assert.equal(error, null);
    assert.equal(data.phone, null);
  });

  it('keeps the signup snapshot hidden from anonymous readers', async () => {
    const anon = createClient(url!, publicKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.from('profiles').select('phone').eq('id', validUserId);

    assert.equal(error, null);
    assert.deepEqual(data, []);
  });
});
