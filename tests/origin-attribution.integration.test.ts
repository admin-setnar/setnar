import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';

import { ORIGIN_IDS } from '@/modules/analytics/domain/origin';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * SET-84 D3 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md §3, passo 3) —
 * testes de segurança/isolamento/regressão da atribuição mínima de origem,
 * contra `record_page_visit`/`record_whatsapp_click`/`submit_lead` com
 * `p_origin` (20260908000002_add_origin_write_functions.sql).
 *
 * Isolamento entre representantes aqui significa isolamento de ESCRITA
 * (o `origin` passado numa chamada nunca contamina a linha de outro par
 * representative/product), não leitura via RLS entre dois representantes —
 * `supabase/README.md` já registra que "nenhum teste automatizado deste
 * repositório exercita RLS [de leitura própria] contra um banco real"
 * (ver `tests/rls-policy-cycle.integration.test.ts`); essa cobertura
 * continua sendo o roteiro manual do README, não este arquivo.
 *
 * Mesmo padrão de fixture descartável de `tests/lead-submission.integration.test.ts`
 * (SET-79: nunca descobre uma activation publicada real como alvo de escrita,
 * sempre cria e depois remove a própria representative/subscription/activation).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRunPublic = Boolean(SUPABASE_URL && SUPABASE_KEY);
const canRunPrivileged = Boolean(SUPABASE_URL && SUPABASE_KEY && SERVICE_ROLE_KEY);
const skipReason =
  'Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY, with all migrations applied, to run this suite.';

const anon = canRunPublic ? createClient(SUPABASE_URL!, SUPABASE_KEY!) : null;
const service = canRunPrivileged ? createIntegrationServiceRoleClient() : null;

const generatedIpHashes = new Set<string>();
function freshIpHash(label: string): string {
  const ipHash = `origin-attribution-test-${label}-${randomUUID()}`;
  generatedIpHashes.add(ipHash);
  return ipHash;
}

async function recordPageVisit(
  client: SupabaseClient,
  args: Record<string, unknown>,
): Promise<{ data: boolean | null; error: PostgrestError | null }> {
  const { data, error } = await client.rpc('record_page_visit', args);
  return { data: data as boolean | null, error };
}

async function recordWhatsappClick(
  client: SupabaseClient,
  args: Record<string, unknown>,
): Promise<{ data: boolean | null; error: PostgrestError | null }> {
  const { data, error } = await client.rpc('record_whatsapp_click', args);
  return { data: data as boolean | null, error };
}

async function submitLead(
  client: SupabaseClient,
  args: Record<string, unknown>,
): Promise<{ data: boolean | null; error: PostgrestError | null }> {
  const { data, error } = await client.rpc('submit_lead', args);
  return { data: data as boolean | null, error };
}

type Fixture = {
  userId: string;
  representativeId: string;
  subscriptionId: string;
  activationId: string;
  slug: string;
  password: string;
  email: string;
};

let productId = '';
let productSlug = '';
let companyId = '';
let fixtureA: Fixture | null = null;
let fixtureB: Fixture | null = null;

async function createFixture(label: string): Promise<Fixture> {
  const email = `origin-attribution-${label}-${randomUUID()}@example.invalid`;
  const password = `T3st-${randomUUID()}-Aa`;
  const { data: userData, error: userError } = await service!.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(userError, null);
  const userId = userData.user!.id;

  const slug = `origin-attribution-${label}-${randomUUID()}`;
  const { data: representative, error: representativeError } = await service!
    .from('representatives')
    .insert({
      profile_id: userId,
      company_id: companyId,
      slug,
      display_name: `Fixture Origin ${label}`,
      authorization_id: `test-${randomUUID()}`,
      phone: '+5511988887777',
      status: 'active',
    })
    .select('id')
    .single();
  assert.equal(representativeError, null);
  const representativeId = representative!.id;

  const { data: subscription, error: subscriptionError } = await service!
    .from('subscriptions')
    .insert({ representative_id: representativeId, status: 'active', provider: 'test' })
    .select('id')
    .single();
  assert.equal(subscriptionError, null);

  const { data: activation, error: activationError } = await service!
    .from('product_activations')
    .insert({
      representative_id: representativeId,
      product_id: productId,
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  assert.equal(activationError, null);

  return {
    userId,
    representativeId,
    subscriptionId: subscription!.id,
    activationId: activation!.id,
    slug,
    password,
    email,
  };
}

async function destroyFixture(fixture: Fixture, cleanupErrors: string[]): Promise<void> {
  const recordError = (label: string, error: { message: string } | null) => {
    if (error) cleanupErrors.push(`${label} (${fixture.slug}): ${error.message}`);
  };

  recordError(
    'analytics_events',
    (await service!.from('analytics_events').delete().eq('representative_id', fixture.representativeId)).error,
  );
  recordError(
    'leads',
    (await service!.from('leads').delete().eq('representative_id', fixture.representativeId)).error,
  );
  recordError(
    'product activation',
    (await service!.from('product_activations').delete().eq('id', fixture.activationId)).error,
  );
  recordError(
    'subscription',
    (await service!.from('subscriptions').delete().eq('id', fixture.subscriptionId)).error,
  );
  recordError(
    'representative',
    (await service!.from('representatives').delete().eq('id', fixture.representativeId)).error,
  );
  recordError('auth user', (await service!.auth.admin.deleteUser(fixture.userId)).error);

  const { count: remainingEvents, error: remainingEventsError } = await service!
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('representative_id', fixture.representativeId);
  recordError('analytics_events cleanup verification', remainingEventsError);
  assert.equal(remainingEvents, 0, `${fixture.slug}: analytics_events must be fully removed`);

  const { count: remainingLeads, error: remainingLeadsError } = await service!
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('representative_id', fixture.representativeId);
  recordError('leads cleanup verification', remainingLeadsError);
  assert.equal(remainingLeads, 0, `${fixture.slug}: leads must be fully removed`);
}

describe('SET-84 D3 origin attribution (Postgres, integration)', { skip: !canRunPrivileged && skipReason }, () => {
  before(async () => {
    const { data: product, error: productError } = await service!
      .from('products')
      .select('id, slug, company_id')
      .limit(1)
      .single();
    assert.equal(productError, null);
    productId = product!.id;
    productSlug = product!.slug;
    companyId = product!.company_id;

    fixtureA = await createFixture('a');
    fixtureB = await createFixture('b');
  });

  after(async () => {
    const cleanupErrors: string[] = [];
    if (fixtureA) await destroyFixture(fixtureA, cleanupErrors);
    if (fixtureB) await destroyFixture(fixtureB, cleanupErrors);

    if (generatedIpHashes.size) {
      const { error } = await service!
        .from('lead_submission_attempts')
        .delete()
        .in('ip_hash', [...generatedIpHashes]);
      if (error) cleanupErrors.push(`lead_submission_attempts: ${error.message}`);

      const { count: remainingAttempts, error: remainingAttemptsError } = await service!
        .from('lead_submission_attempts')
        .select('id', { count: 'exact', head: true })
        .in('ip_hash', [...generatedIpHashes]);
      if (remainingAttemptsError) cleanupErrors.push(`attempt cleanup verification: ${remainingAttemptsError.message}`);
      assert.equal(remainingAttempts, 0, 'the generated rate-limit buckets must be removed');
    }

    assert.deepEqual(cleanupErrors, [], 'the disposable origin-attribution fixtures must be fully removed');
  });

  describe('grants: p_origin does not loosen the existing service_role-only boundary', { skip: !canRunPublic }, () => {
    it('denies anon on record_page_visit even with p_origin supplied', async () => {
      const { error } = await recordPageVisit(anon!, {
        p_representative_slug: `untrusted-${randomUUID()}`,
        p_product_slug: `untrusted-${randomUUID()}`,
        p_referrer: null,
        p_ip_hash: `browser-chosen-${randomUUID()}`,
        p_user_agent: 'Mozilla/5.0',
        p_origin: 'instagram_post',
      });
      assert.ok(error, 'anon unexpectedly invoked record_page_visit');
      assert.match(error.message, /permission denied/i);
    });

    it('denies anon on record_whatsapp_click even with p_origin supplied', async () => {
      const { error } = await recordWhatsappClick(anon!, {
        p_representative_slug: `untrusted-${randomUUID()}`,
        p_product_slug: `untrusted-${randomUUID()}`,
        p_referrer: null,
        p_ip_hash: `browser-chosen-${randomUUID()}`,
        p_user_agent: 'Mozilla/5.0',
        p_origin: 'whatsapp',
      });
      assert.ok(error, 'anon unexpectedly invoked record_whatsapp_click');
      assert.match(error.message, /permission denied/i);
    });

    it('denies anon on submit_lead even with p_origin supplied', async () => {
      const { error } = await submitLead(anon!, {
        p_representative_id: randomUUID(),
        p_product_id: randomUUID(),
        p_telefone_e164: '+5511988887777',
        p_nome: 'Lead Teste',
        p_cidade: null,
        p_email: null,
        p_origem: 'commercial_page',
        p_referrer: null,
        p_ip_hash: freshIpHash('anon-denied'),
        p_origin: 'direct',
      });
      assert.ok(error, 'anon unexpectedly invoked submit_lead');
      assert.match(error.message, /permission denied/i);
    });
  });

  describe('regression: absent p_origin persists null and never rejects the write', () => {
    it('record_page_visit without p_origin still succeeds and persists origin null', async () => {
      const ipHash = freshIpHash('visit-no-origin');
      const { data, error } = await recordPageVisit(service!, {
        p_representative_slug: fixtureA!.slug,
        p_product_slug: productSlug,
        p_referrer: null,
        p_ip_hash: ipHash,
        p_user_agent: 'Mozilla/5.0',
      });
      assert.equal(error, null);
      assert.equal(data, true, 'omitting p_origin must not regress the existing call shape');

      const { data: row, error: rowError } = await service!
        .from('analytics_events')
        .select('origin')
        .eq('ip_hash', ipHash)
        .single();
      assert.equal(rowError, null);
      assert.equal(row!.origin, null);
    });

    it('submit_lead without p_origin still succeeds, keeps origem untouched, persists origin null', async () => {
      const ipHash = freshIpHash('lead-no-origin');
      const { data, error } = await submitLead(service!, {
        p_representative_id: fixtureA!.representativeId,
        p_product_id: productId,
        p_telefone_e164: '+5511988887777',
        p_nome: 'Lead Sem Origin',
        p_cidade: null,
        p_email: null,
        p_origem: 'commercial_page',
        p_referrer: null,
        p_ip_hash: ipHash,
      });
      assert.equal(error, null);
      assert.equal(data, true);

      const { data: row, error: rowError } = await service!
        .from('leads')
        .select('origem, origin')
        .eq('representative_id', fixtureA!.representativeId)
        .eq('telefone_e164', '+5511988887777')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      assert.equal(rowError, null);
      assert.equal(row!.origem, 'commercial_page', 'p_origem (capture surface) must be unaffected by the new column');
      assert.equal(row!.origin, null);
    });
  });

  describe('invalid p_origin degrades to null instead of rejecting the write', () => {
    it('record_page_visit with an unknown origin still succeeds, persists origin null', async () => {
      const ipHash = freshIpHash('visit-invalid-origin');
      const { data, error } = await recordPageVisit(service!, {
        p_representative_slug: fixtureA!.slug,
        p_product_slug: productSlug,
        p_referrer: null,
        p_ip_hash: ipHash,
        p_user_agent: 'Mozilla/5.0',
        p_origin: 'facebook_ads_totally_made_up',
      });
      assert.equal(error, null);
      assert.equal(data, true, 'an unknown origin must degrade, never reject the page');

      const { data: row, error: rowError } = await service!
        .from('analytics_events')
        .select('origin')
        .eq('ip_hash', ipHash)
        .single();
      assert.equal(rowError, null);
      assert.equal(row!.origin, null);
    });

    it('record_whatsapp_click with an unknown origin still succeeds, persists origin null', async () => {
      const ipHash = freshIpHash('click-invalid-origin');
      const { data, error } = await recordWhatsappClick(service!, {
        p_representative_slug: fixtureA!.slug,
        p_product_slug: productSlug,
        p_referrer: null,
        p_ip_hash: ipHash,
        p_user_agent: 'Mozilla/5.0',
        p_origin: '',
      });
      assert.equal(error, null);
      assert.equal(data, true, 'an empty-string origin must degrade, never reject the click');

      const { data: row, error: rowError } = await service!
        .from('analytics_events')
        .select('origin')
        .eq('ip_hash', ipHash)
        .single();
      assert.equal(rowError, null);
      assert.equal(row!.origin, null);
    });

    it('submit_lead with an unknown origin still succeeds, persists origin null', async () => {
      const ipHash = freshIpHash('lead-invalid-origin');
      const { data, error } = await submitLead(service!, {
        p_representative_id: fixtureA!.representativeId,
        p_product_id: productId,
        p_telefone_e164: '+5511988880001',
        p_nome: 'Lead Origin Invalida',
        p_cidade: null,
        p_email: null,
        p_origem: 'commercial_page',
        p_referrer: null,
        p_ip_hash: ipHash,
        p_origin: 'not-a-real-origin',
      });
      assert.equal(error, null);
      assert.equal(data, true);

      const { data: row, error: rowError } = await service!
        .from('leads')
        .select('origin')
        .eq('representative_id', fixtureA!.representativeId)
        .eq('telefone_e164', '+5511988880001')
        .single();
      assert.equal(rowError, null);
      assert.equal(row!.origin, null);
    });
  });

  describe('each valid OriginId round-trips through record_page_visit', () => {
    for (const origin of ORIGIN_IDS) {
      it(`persists origin = '${origin}' unchanged`, async () => {
        const ipHash = freshIpHash(`roundtrip-${origin}`);
        const { data, error } = await recordPageVisit(service!, {
          p_representative_slug: fixtureA!.slug,
          p_product_slug: productSlug,
          p_referrer: null,
          p_ip_hash: ipHash,
          p_user_agent: 'Mozilla/5.0',
          p_origin: origin,
        });
        assert.equal(error, null);
        assert.equal(data, true);

        const { data: row, error: rowError } = await service!
          .from('analytics_events')
          .select('origin')
          .eq('ip_hash', ipHash)
          .single();
        assert.equal(rowError, null);
        assert.equal(row!.origin, origin);
      });
    }
  });

  describe('visita -> whatsapp_click e visita -> lead: mesma origem, cada chamada persiste a sua própria linha', () => {
    it('record_page_visit and a subsequent record_whatsapp_click both persist the same origin for the same pair', async () => {
      const visitIpHash = freshIpHash('visit-then-click-visit');
      const clickIpHash = freshIpHash('visit-then-click-click');

      const visit = await recordPageVisit(service!, {
        p_representative_slug: fixtureA!.slug,
        p_product_slug: productSlug,
        p_referrer: null,
        p_ip_hash: visitIpHash,
        p_user_agent: 'Mozilla/5.0',
        p_origin: 'instagram_story',
      });
      assert.equal(visit.error, null);
      assert.equal(visit.data, true);

      const click = await recordWhatsappClick(service!, {
        p_representative_slug: fixtureA!.slug,
        p_product_slug: productSlug,
        p_referrer: null,
        p_ip_hash: clickIpHash,
        p_user_agent: 'Mozilla/5.0',
        p_origin: 'instagram_story',
      });
      assert.equal(click.error, null);
      assert.equal(click.data, true);

      const { data: visitRow, error: visitRowError } = await service!
        .from('analytics_events')
        .select('origin, event_type')
        .eq('ip_hash', visitIpHash)
        .single();
      assert.equal(visitRowError, null);
      assert.equal(visitRow!.event_type, 'visit');
      assert.equal(visitRow!.origin, 'instagram_story');

      const { data: clickRow, error: clickRowError } = await service!
        .from('analytics_events')
        .select('origin, event_type')
        .eq('ip_hash', clickIpHash)
        .single();
      assert.equal(clickRowError, null);
      assert.equal(clickRow!.event_type, 'whatsapp_click');
      assert.equal(clickRow!.origin, 'instagram_story');
    });

    it('record_page_visit and a subsequent submit_lead both persist the same origin for the same pair', async () => {
      const visitIpHash = freshIpHash('visit-then-lead-visit');
      const leadIpHash = freshIpHash('visit-then-lead-lead');

      const visit = await recordPageVisit(service!, {
        p_representative_slug: fixtureA!.slug,
        p_product_slug: productSlug,
        p_referrer: null,
        p_ip_hash: visitIpHash,
        p_user_agent: 'Mozilla/5.0',
        p_origin: 'qrcode',
      });
      assert.equal(visit.error, null);
      assert.equal(visit.data, true);

      const lead = await submitLead(service!, {
        p_representative_id: fixtureA!.representativeId,
        p_product_id: productId,
        p_telefone_e164: '+5511988880002',
        p_nome: 'Lead Apos Visita QR',
        p_cidade: null,
        p_email: null,
        p_origem: 'commercial_page',
        p_referrer: null,
        p_ip_hash: leadIpHash,
        p_origin: 'qrcode',
      });
      assert.equal(lead.error, null);
      assert.equal(lead.data, true);

      const { data: leadRow, error: leadRowError } = await service!
        .from('leads')
        .select('origem, origin')
        .eq('representative_id', fixtureA!.representativeId)
        .eq('telefone_e164', '+5511988880002')
        .single();
      assert.equal(leadRowError, null);
      assert.equal(leadRow!.origem, 'commercial_page');
      assert.equal(leadRow!.origin, 'qrcode');
    });
  });

  describe('isolamento entre representantes: origin nunca vaza para o par (representative, product) do outro', () => {
    it('a visit recorded for fixture A never appears under fixture B, and vice-versa', async () => {
      const ipHashA = freshIpHash('isolation-visit-a');
      const ipHashB = freshIpHash('isolation-visit-b');

      const visitA = await recordPageVisit(service!, {
        p_representative_slug: fixtureA!.slug,
        p_product_slug: productSlug,
        p_referrer: null,
        p_ip_hash: ipHashA,
        p_user_agent: 'Mozilla/5.0',
        p_origin: 'instagram_post',
      });
      assert.equal(visitA.error, null);
      assert.equal(visitA.data, true);

      const visitB = await recordPageVisit(service!, {
        p_representative_slug: fixtureB!.slug,
        p_product_slug: productSlug,
        p_referrer: null,
        p_ip_hash: ipHashB,
        p_user_agent: 'Mozilla/5.0',
        p_origin: 'whatsapp',
      });
      assert.equal(visitB.error, null);
      assert.equal(visitB.data, true);

      // Scoped by this test's own ip_hash, not by "does representative_id X
      // ever have origin Y" — fixtureA/fixtureB are shared across the whole
      // file (e.g. the round-trip describe above already wrote an
      // origin='whatsapp' row for fixtureA), so a blanket "this origin value
      // never appears under this representative" claim would be a false
      // positive on suite composition, not a real isolation check. The real
      // property is: the row this call just wrote landed on the right
      // representative_id with the right origin — never the other pair's.
      const { data: rowA, error: rowAError } = await service!
        .from('analytics_events')
        .select('representative_id, origin')
        .eq('ip_hash', ipHashA)
        .single();
      assert.equal(rowAError, null);
      assert.equal(rowA!.representative_id, fixtureA!.representativeId);
      assert.equal(rowA!.origin, 'instagram_post');

      const { data: rowB, error: rowBError } = await service!
        .from('analytics_events')
        .select('representative_id, origin')
        .eq('ip_hash', ipHashB)
        .single();
      assert.equal(rowBError, null);
      assert.equal(rowB!.representative_id, fixtureB!.representativeId);
      assert.equal(rowB!.origin, 'whatsapp');
    });

    it("submit_lead scoped to fixture A's ids cannot write under fixture B even when B's slug/origin are similar", async () => {
      const ipHash = freshIpHash('isolation-lead-a');
      const { data, error } = await submitLead(service!, {
        p_representative_id: fixtureA!.representativeId,
        p_product_id: productId,
        p_telefone_e164: '+5511988880003',
        p_nome: 'Lead Isolamento',
        p_cidade: null,
        p_email: null,
        p_origem: 'commercial_page',
        p_referrer: null,
        p_ip_hash: ipHash,
        p_origin: 'direct',
      });
      assert.equal(error, null);
      assert.equal(data, true);

      const { count: underB, error: underBError } = await service!
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('representative_id', fixtureB!.representativeId)
        .eq('telefone_e164', '+5511988880003');
      assert.equal(underBError, null);
      assert.equal(underB, 0, "a lead submitted for fixture A's representative_id must never be readable under fixture B");
    });
  });
});
