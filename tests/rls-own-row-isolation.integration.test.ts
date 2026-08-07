import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * SET-10: automates the manual roteiro `supabase/README.md` §"Verificação
 * manual obrigatória — policies de leitura própria (passo 8)" has run by
 * hand since 2026-08-01. That roteiro predates `SUPABASE_SERVICE_ROLE_KEY`
 * existing in this project (see `register-representative.integration.test.ts`'s
 * header) — a disposable pair of accounts had to be created through the app
 * and left behind, since `representatives` has no DELETE policy reachable by
 * the publishable key. The service role introduced for Analytics/Leads
 * (ADR-065/ADR-067) removes that constraint: this suite creates its own
 * disposable A/B pair via `auth.admin.createUser` and tears them down in
 * `after`, so the exact two assertions that matter — A sees A, A never sees
 * B — run on every `npm run verify`, not just when someone remembers to
 * click through the checklist.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createClient(url!, serviceKey!, { auth: { persistSession: false } }) : null;
const anon = canRun ? createClient(url!, publicKey!) : null;

let userAId = '';
let userBId = '';
let representativeAId = '';
let representativeBId = '';
let clientA: SupabaseClient | null = null;
let clientB: SupabaseClient | null = null;

async function createTestRepresentative(label: string): Promise<{ userId: string; repId: string; client: SupabaseClient }> {
  const email = `rls-isolation-${label}-${randomUUID()}@example.invalid`;
  const password = `T3st-${randomUUID()}-Aa`;
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
      slug: `rls-isolation-${label}-${randomUUID()}`,
      display_name: `Teste Isolamento ${label}`,
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

  return { userId, repId: representative!.id, client };
}

describe('own-row RLS isolation between representatives (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const a = await createTestRepresentative('a');
    userAId = a.userId;
    representativeAId = a.repId;
    clientA = a.client;

    const b = await createTestRepresentative('b');
    userBId = b.userId;
    representativeBId = b.repId;
    clientB = b.client;
  });

  after(async () => {
    if (representativeAId) await service!.from('representatives').delete().eq('id', representativeAId);
    if (representativeBId) await service!.from('representatives').delete().eq('id', representativeBId);
    if (userAId) await service!.auth.admin.deleteUser(userAId);
    if (userBId) await service!.auth.admin.deleteUser(userBId);
  });

  it('lets A read its own representative row (representatives_select_own)', async () => {
    const { data, error } = await clientA!.from('representatives').select('id').eq('id', representativeAId);
    assert.equal(error, null);
    assert.equal(data?.length, 1, 'A must see its own row — this failed before 20260804000000');
  });

  it('never lets A read B\'s representative row, filtering by B\'s id explicitly', async () => {
    const { data, error } = await clientA!.from('representatives').select('id').eq('id', representativeBId);
    assert.equal(error, null);
    assert.equal(data?.length, 0, 'representatives_select_own must not leak across representatives');
  });

  it('lets B read its own row while still not seeing A\'s', async () => {
    const own = await clientB!.from('representatives').select('id').eq('id', representativeBId);
    assert.equal(own.error, null);
    assert.equal(own.data?.length, 1);

    const other = await clientB!.from('representatives').select('id').eq('id', representativeAId);
    assert.equal(other.error, null);
    assert.equal(other.data?.length, 0);
  });

  it('shows neither A nor B to an anonymous caller (no session at all)', async () => {
    const { data, error } = await anon!
      .from('representatives')
      .select('id')
      .in('id', [representativeAId, representativeBId]);
    assert.equal(error, null);
    assert.equal(data?.length, 0, 'representatives_select_public requires status=active AND a published activation — neither A nor B has one');
  });

  it('extends the same isolation to product_activations (own-row, even in draft)', async () => {
    const { data: activation, error: activationError } = await service!
      .from('product_activations')
      .insert({ representative_id: representativeAId, product_id: (await service!.from('products').select('id').limit(1).single()).data!.id, status: 'draft' })
      .select('id')
      .single();
    assert.equal(activationError, null);

    const ownRead = await clientA!.from('product_activations').select('id').eq('id', activation!.id);
    assert.equal(ownRead.error, null);
    assert.equal(ownRead.data?.length, 1, 'A must see its own draft activation (product_activations_select_own, passo 8)');

    const crossRead = await clientB!.from('product_activations').select('id').eq('id', activation!.id);
    assert.equal(crossRead.error, null);
    assert.equal(crossRead.data?.length, 0, 'B must never see A\'s draft activation');

    await service!.from('product_activations').delete().eq('id', activation!.id);
  });
});
