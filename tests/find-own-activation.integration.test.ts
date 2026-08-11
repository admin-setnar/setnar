import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * SET-36: `SupabaseRepresentativeRepository.findOwnActivation`'s own query,
 * exercised against a real Postgres project — not just the raw
 * `product_activations_select_own` RLS proof
 * `tests/rls-own-row-isolation.integration.test.ts` already gives (SET-10).
 * That suite proves the table-level boundary with a plain `.select('id')`;
 * this one proves the actual query shape the adapter builds on top of it
 * (the `representative.profile_id` embedded-relation filter, the
 * `representatives!inner`/`products!inner` join, the status narrowing)
 * resolves the right (Representative, Product, status) triple end-to-end,
 * for every status the preview needs.
 *
 * `findOwnActivation` below is a deliberate copy of
 * `modules/representatives/infrastructure/supabase-representative-repository.ts`'s
 * own method body, not an import of it: that file starts with
 * `import 'server-only'`, which throws outside a Next.js server request —
 * exactly the guard doing its job, since this file runs under plain
 * `node:test`. Keep this copy's query in sync with the real adapter by hand;
 * a drift here would mean this test stops proving what it claims to.
 */
interface RepresentativeRow {
  id: string;
  slug: string;
  display_name: string;
  authorization_id: string;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
  status: string;
}
interface ProductRow {
  id: string;
  slug: string;
  name: string;
  company: { slug: string } | null;
}
interface ProductActivationRow {
  status: string;
  representative: RepresentativeRow | null;
  product: ProductRow | null;
}

async function findOwnActivation(client: SupabaseClient, profileId: string, productSlug: string) {
  const { data, error } = await client
    .from('product_activations')
    .select(
      `
      status,
      representative:representatives!inner (
        id, slug, display_name, authorization_id, phone, city, avatar_url, status
      ),
      product:products!inner ( id, slug, name, company:companies!inner ( slug ) )
    `,
    )
    .eq('representative.profile_id', profileId)
    .eq('product.slug', productSlug)
    .maybeSingle<ProductActivationRow>();

  if (error || !data || !data.representative || !data.product || !data.product.company) return null;
  if (data.status !== 'draft' && data.status !== 'published' && data.status !== 'unpublished') return null;

  return {
    representative: data.representative,
    product: data.product,
    status: data.status,
  };
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createClient(url!, serviceKey!, { auth: { persistSession: false } }) : null;

let ownerUserId = '';
let ownerRepresentativeId = '';
let otherUserId = '';
let otherRepresentativeId = '';
let ownerClient: SupabaseClient | null = null;
let otherClient: SupabaseClient | null = null;
let productId = '';
let productSlug = '';

async function createTestRepresentative(label: string): Promise<{ userId: string; repId: string; client: SupabaseClient }> {
  const email = `find-own-activation-${label}-${randomUUID()}@example.invalid`;
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
      slug: `find-own-activation-${label}-${randomUUID()}`,
      display_name: `Teste Preview ${label}`,
      authorization_id: `test-${randomUUID()}`,
      phone: '+5511977776666',
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

async function setOwnerActivationStatus(status: 'draft' | 'unpublished' | 'published') {
  await service!.from('product_activations').delete().eq('representative_id', ownerRepresentativeId);
  await service!
    .from('product_activations')
    .insert({ representative_id: ownerRepresentativeId, product_id: productId, status });
}

describe('findOwnActivation query (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const owner = await createTestRepresentative('owner');
    ownerUserId = owner.userId;
    ownerRepresentativeId = owner.repId;
    ownerClient = owner.client;

    const other = await createTestRepresentative('other');
    otherUserId = other.userId;
    otherRepresentativeId = other.repId;
    otherClient = other.client;

    const { data: product } = await service!.from('products').select('id, slug').limit(1).single();
    productId = product!.id;
    productSlug = product!.slug;
  });

  after(async () => {
    if (ownerRepresentativeId) {
      await service!.from('product_activations').delete().eq('representative_id', ownerRepresentativeId);
      await service!.from('representatives').delete().eq('id', ownerRepresentativeId);
    }
    if (otherRepresentativeId) await service!.from('representatives').delete().eq('id', otherRepresentativeId);
    if (ownerUserId) await service!.auth.admin.deleteUser(ownerUserId);
    if (otherUserId) await service!.auth.admin.deleteUser(otherUserId);
  });

  it('returns null when the caller has no activation for that product at all', async () => {
    assert.equal(await findOwnActivation(ownerClient!, ownerUserId, productSlug), null);
  });

  it('resolves a draft activation, status included', async () => {
    await setOwnerActivationStatus('draft');
    const result = await findOwnActivation(ownerClient!, ownerUserId, productSlug);
    assert.ok(result, 'the owner must be able to preview their own draft');
    assert.equal(result.product.slug, productSlug);
    assert.equal(result.status, 'draft');
  });

  it('resolves an unpublished activation', async () => {
    await setOwnerActivationStatus('unpublished');
    const result = await findOwnActivation(ownerClient!, ownerUserId, productSlug);
    assert.ok(result);
    assert.equal(result.status, 'unpublished');
  });

  it('resolves a published activation too — the owner can preview the live page as well', async () => {
    await setOwnerActivationStatus('published');
    const result = await findOwnActivation(ownerClient!, ownerUserId, productSlug);
    assert.ok(result);
    assert.equal(result.status, 'published');
  });

  it('never resolves another representative\'s activation, even signed in as them, when asked for the FIRST representative\'s profileId', async () => {
    // `otherClient` is authenticated as `other`, but findOwnActivation is
    // called with `ownerUserId` — RLS scopes every read to whoever the
    // SESSION actually is, never to a profileId argument the caller
    // supplies. A malicious/buggy caller passing someone else's id must
    // still only ever see their OWN row (or nothing), never the owner's.
    assert.equal(await findOwnActivation(otherClient!, ownerUserId, productSlug), null);
  });

  it('returns null for an anonymous (unauthenticated) client, regardless of whose profileId is asked for', async () => {
    const anon = createClient(url!, publicKey!, { auth: { persistSession: false } });
    assert.equal(await findOwnActivation(anon, ownerUserId, productSlug), null);
  });
});
