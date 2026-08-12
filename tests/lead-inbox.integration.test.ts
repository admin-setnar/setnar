import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface InboxRow {
  id: string;
  telefone_e164: string;
  campos: unknown;
  created_at: string;
  product: { name: string } | null;
}

async function listPage(
  client: SupabaseClient,
  representativeId: string,
  cursor: { receivedAt: string; id: string } | null,
  limit: number,
) {
  let query = client
    .from('leads')
    .select('id, telefone_e164, campos, created_at, product:products(name)')
    .eq('representative_id', representativeId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.receivedAt},and(created_at.eq.${cursor.receivedAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  assert.equal(error, null, error?.message);
  const rows = (data ?? []) as unknown as InboxRow[];
  const visible = rows.slice(0, limit);
  const last = visible.at(-1);
  return {
    rows: visible,
    nextCursor: rows.length > limit && last ? { receivedAt: last.created_at, id: last.id } : null,
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
let ownerLeadIds: string[] = [];
let otherLeadId = '';

async function createRepresentative(label: string) {
  const email = `lead-inbox-${label}-${randomUUID()}@example.invalid`;
  const password = `T3st-${randomUUID()}-Aa`;
  const { data: userData, error: userError } = await service!.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(userError, null);

  const { data: product, error: productError } = await service!
    .from('products')
    .select('company_id')
    .limit(1)
    .single();
  assert.equal(productError, null);

  const { data: representative, error: representativeError } = await service!
    .from('representatives')
    .insert({
      profile_id: userData.user!.id,
      company_id: product!.company_id,
      slug: `lead-inbox-${label}-${randomUUID()}`,
      display_name: `Teste Contatos ${label}`,
      authorization_id: `test-${randomUUID()}`,
      phone: '+5511977776666',
      status: 'active',
    })
    .select('id')
    .single();
  assert.equal(representativeError, null);

  const client = createClient(url!, publicKey!, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  assert.equal(signInError, null);

  return { userId: userData.user!.id, representativeId: representative!.id, client };
}

describe('lead inbox query (Postgres, integration)', { skip: !canRun }, () => {
  before(async () => {
    const owner = await createRepresentative('owner');
    ownerUserId = owner.userId;
    ownerRepresentativeId = owner.representativeId;
    ownerClient = owner.client;

    const other = await createRepresentative('other');
    otherUserId = other.userId;
    otherRepresentativeId = other.representativeId;
    otherClient = other.client;

    const { data: product } = await service!.from('products').select('id').limit(1).single();
    productId = product!.id;

    ownerLeadIds = Array.from({ length: 5 }, () => randomUUID());
    const tieTimestamp = '2026-08-12T18:30:00.000Z';
    const rows = ownerLeadIds.map((id, index) => ({
      id,
      representative_id: ownerRepresentativeId,
      product_id: productId,
      telefone_e164: `+55119999999${index}`,
      campos: { nome: `Contato ${index}` },
      created_at: index < 3 ? tieTimestamp : `2026-08-${10 - index}T18:30:00.000Z`,
    }));
    const { error: ownerInsertError } = await service!.from('leads').insert(rows);
    assert.equal(ownerInsertError, null);

    otherLeadId = randomUUID();
    const { error: otherInsertError } = await service!.from('leads').insert({
      id: otherLeadId,
      representative_id: otherRepresentativeId,
      product_id: productId,
      telefone_e164: '+5511888888888',
      campos: { nome: 'Contato de outro representante' },
    });
    assert.equal(otherInsertError, null);
  });

  after(async () => {
    if (ownerLeadIds.length) await service!.from('leads').delete().in('id', ownerLeadIds);
    if (otherLeadId) await service!.from('leads').delete().eq('id', otherLeadId);
    if (ownerRepresentativeId) await service!.from('representatives').delete().eq('id', ownerRepresentativeId);
    if (otherRepresentativeId) await service!.from('representatives').delete().eq('id', otherRepresentativeId);
    if (ownerUserId) await service!.auth.admin.deleteUser(ownerUserId);
    if (otherUserId) await service!.auth.admin.deleteUser(otherUserId);
  });

  it('returns only the signed-in representative own rows', async () => {
    const ownerPage = await listPage(ownerClient!, ownerRepresentativeId, null, 20);
    assert.deepEqual(new Set(ownerPage.rows.map((row) => row.id)), new Set(ownerLeadIds));
    assert.ok(ownerPage.rows.every((row) => row.product?.name));

    const crossTenant = await listPage(otherClient!, ownerRepresentativeId, null, 20);
    assert.deepEqual(crossTenant.rows, []);
  });

  it('returns no rows to an anonymous caller', async () => {
    const anon = createClient(url!, publicKey!, { auth: { persistSession: false } });
    assert.deepEqual((await listPage(anon, ownerRepresentativeId, null, 20)).rows, []);
  });

  it('paginates tied timestamps without duplicates or gaps', async () => {
    const seen: string[] = [];
    let cursor: { receivedAt: string; id: string } | null = null;

    do {
      const page = await listPage(ownerClient!, ownerRepresentativeId, cursor, 2);
      seen.push(...page.rows.map((row) => row.id));
      cursor = page.nextCursor;
    } while (cursor);

    assert.equal(new Set(seen).size, ownerLeadIds.length);
    assert.deepEqual(new Set(seen), new Set(ownerLeadIds));
  });
});
