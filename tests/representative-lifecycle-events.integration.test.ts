import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * SET-116 (`docs/plans/AUDIT_STAGE_1_KPI_HISTORICAL_INTEGRITY_2026-09-01.md`
 * R1/R3/R4, migration `20260910000000_add_representative_lifecycle_events.sql`):
 * prova, contra um banco Postgres real, que os três marcos lifetime
 * (`representative_registered`, `first_page_published`, `first_result`) são
 * gravados exatamente uma vez, sobrevivem a unpublish→republish, e que um
 * cliente `authenticated` comum não consegue ler/adulterar a trilha.
 *
 * Mesmo padrão de fixture de `trial-lifecycle.integration.test.ts` (registro
 * real via RPC como o próprio dono) + `representative-delete-audit.integration.test.ts`
 * (asserções de RLS via `fx.owner`).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createIntegrationServiceRoleClient() : null;

const createdUserIds: string[] = [];

interface Fixture {
  readonly userId: string;
  readonly representativeId: string;
  readonly owner: SupabaseClient;
}

async function registerFreshRepresentative(prefix: string): Promise<Fixture> {
  const unique = randomUUID();
  const email = `lifecycle-events-${prefix}-${unique}@example.invalid`;
  const password = `T3st-${unique}-Aa!`;
  const { data: userData, error: userError } = await service!.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(userError, null);
  const userId = userData.user!.id;
  createdUserIds.push(userId);

  const owner = createClient(url!, publicKey!, { auth: { persistSession: false } });
  const { error: signInError } = await owner.auth.signInWithPassword({ email, password });
  assert.equal(signInError, null);

  const { data: registered, error: registerError } = await owner.rpc('register_representative', {
    p_slug: `lifecycle-events-${prefix}-${unique}`,
    p_display_name: `Teste Lifecycle ${prefix}`,
    p_authorization_id: `lifecycle-${unique}`,
    p_phone: '+5511988887777',
    p_city: null,
  });
  assert.equal(registerError, null);
  assert.equal(registered?.[0]?.status, 'created');
  const representativeId = registered![0]!.representative_id as string;

  return { userId, representativeId, owner };
}

async function eventsFor(representativeId: string) {
  const { data, error } = await service!
    .from('representative_lifecycle_events')
    .select('*')
    .eq('representative_id', representativeId)
    .order('id', { ascending: true });
  assert.equal(error, null);
  return data!;
}

async function firstIgreenProductId(): Promise<string> {
  const { data, error } = await service!.from('products').select('id').limit(1).single();
  assert.equal(error, null);
  return data!.id as string;
}

describe('representative_lifecycle_events (Postgres, integration)', { skip: !canRun }, () => {
  after(async () => {
    // Filhos antes de representatives (mesma ordem de FK de outras suítes),
    // lifecycle_events não tem FK (por desenho — ver a migration), então não
    // precisa de ordem especial, mas é limpo pelo representative_id mesmo
    // assim para não deixar lixo entre execuções.
    const { data: reps } = await service!.from('representatives').select('id').in('profile_id', createdUserIds);
    const repIds = (reps ?? []).map((r) => r.id as string);
    if (repIds.length > 0) {
      await service!.from('representative_lifecycle_events').delete().in('representative_id', repIds);
      await service!.from('analytics_events').delete().in('representative_id', repIds);
      await service!.from('leads').delete().in('representative_id', repIds);
      await service!.from('product_activations').delete().in('representative_id', repIds);
      await service!.from('subscriptions').delete().in('representative_id', repIds);
      await service!.from('representatives').delete().in('id', repIds);
    }
    for (const userId of createdUserIds) {
      await service!.auth.admin.deleteUser(userId);
    }
  });

  it('Teste 1 — registrar representative grava representative_registered exatamente uma vez', async () => {
    const fx = await registerFreshRepresentative('t1');
    const events = await eventsFor(fx.representativeId);
    assert.equal(events.length, 1);
    assert.equal(events[0].event_type, 'representative_registered');
    assert.equal(events[0].representative_id, fx.representativeId);
    assert.equal(events[0].source, 'register_representative');
    assert.ok(events[0].occurred_at);
  });

  it('Teste 2 — a constraint, não só o código, impede um segundo representative_registered (retry direto no banco)', async () => {
    const fx = await registerFreshRepresentative('t2');

    const { error: duplicateError } = await service!.from('representative_lifecycle_events').insert({
      representative_id: fx.representativeId,
      event_type: 'representative_registered',
      source: 'retry-simulado',
    });
    assert.ok(duplicateError, 'a unique constraint deve rejeitar uma segunda linha do mesmo marco');
    assert.equal(duplicateError!.code, '23505');

    const events = await eventsFor(fx.representativeId);
    assert.equal(events.length, 1, 'nenhum evento duplicado, mesmo depois da tentativa de retry');
  });

  it('Teste 3/4 — first_page_published nasce na primeira publicação e sobrevive a unpublish→republish', async () => {
    const fx = await registerFreshRepresentative('t34');
    const productId = await firstIgreenProductId();

    const { error: activateError } = await fx.owner.rpc('activate_product', { p_product_id: productId });
    assert.equal(activateError, null);

    // Teste 3 — primeira publicação.
    const { data: firstPublish, error: firstPublishError } = await fx.owner.rpc('set_activation_status', {
      p_product_id: productId,
      p_status: 'published',
    });
    assert.equal(firstPublishError, null);
    assert.equal(firstPublish?.[0]?.status, 'updated');

    let events = await eventsFor(fx.representativeId);
    const firstPublishedEvents = events.filter((e) => e.event_type === 'first_page_published');
    assert.equal(firstPublishedEvents.length, 1, 'exatamente um first_page_published após a primeira publicação');
    const originalOccurredAt = firstPublishedEvents[0].occurred_at as string;
    assert.equal(firstPublishedEvents[0].metadata?.product_id, productId);

    // Teste 4 — unpublish → republish do MESMO produto.
    const { error: unpublishError } = await fx.owner.rpc('set_activation_status', {
      p_product_id: productId,
      p_status: 'unpublished',
    });
    assert.equal(unpublishError, null);

    const { error: republishError } = await fx.owner.rpc('set_activation_status', {
      p_product_id: productId,
      p_status: 'published',
    });
    assert.equal(republishError, null);

    events = await eventsFor(fx.representativeId);
    const afterRepublish = events.filter((e) => e.event_type === 'first_page_published');
    assert.equal(afterRepublish.length, 1, 'continua existindo exatamente um first_page_published depois de republicar');
    assert.equal(
      afterRepublish[0].occurred_at,
      originalOccurredAt,
      'o timestamp original do marco não muda quando a página é republicada',
    );
  });

  it('Teste 5/6 — first_result nasce no primeiro clique/lead e não duplica em resultados seguintes', async () => {
    const fx = await registerFreshRepresentative('t56');
    const productId = await firstIgreenProductId();
    await fx.owner.rpc('activate_product', { p_product_id: productId });
    await fx.owner.rpc('set_activation_status', { p_product_id: productId, p_status: 'published' });

    const { data: repRow } = await service!
      .from('representatives')
      .select('slug')
      .eq('id', fx.representativeId)
      .single();
    const { data: productRow } = await service!.from('products').select('slug').eq('id', productId).single();

    // Teste 5 — primeiro resultado (whatsapp_click).
    const { data: clickOk, error: clickError } = await service!.rpc('record_whatsapp_click', {
      p_representative_slug: repRow!.slug,
      p_product_slug: productRow!.slug,
      p_referrer: null,
      p_ip_hash: `lifecycle-test-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0 (integration-test)',
    });
    assert.equal(clickError, null);
    assert.equal(clickOk, true);

    let events = await eventsFor(fx.representativeId);
    let resultEvents = events.filter((e) => e.event_type === 'first_result');
    assert.equal(resultEvents.length, 1, 'exatamente um first_result após o primeiro clique');
    assert.equal(resultEvents[0].metadata?.result_type, 'whatsapp_click');
    const originalOccurredAt = resultEvents[0].occurred_at as string;

    // Teste 6 — um segundo resultado (lead) não deve duplicar nem sobrescrever o marco.
    const { data: leadOk, error: leadError } = await service!.rpc('submit_lead', {
      p_representative_id: fx.representativeId,
      p_product_id: productId,
      p_telefone_e164: '+5511977776666',
      p_nome: 'Teste Lifecycle Lead',
      p_cidade: null,
      p_email: null,
      p_origem: null,
      p_referrer: null,
      p_ip_hash: `lifecycle-test-lead-${randomUUID()}`,
    });
    assert.equal(leadError, null);
    assert.equal(leadOk, true);

    events = await eventsFor(fx.representativeId);
    resultEvents = events.filter((e) => e.event_type === 'first_result');
    assert.equal(resultEvents.length, 1, 'ainda exatamente um first_result depois de um segundo tipo de resultado');
    assert.equal(resultEvents[0].occurred_at, originalOccurredAt, 'o timestamp original não muda');
    assert.equal(
      resultEvents[0].metadata?.result_type,
      'whatsapp_click',
      'o marco preserva o PRIMEIRO tipo de resultado, não é sobrescrito pelo segundo',
    );
  });

  it('Teste 7 — um cliente authenticated comum não pode ler, inserir, alterar nem apagar a trilha de lifecycle events', async () => {
    const fx = await registerFreshRepresentative('t7');

    const { data: selectData, error: selectError } = await fx.owner
      .from('representative_lifecycle_events')
      .select('*')
      .eq('representative_id', fx.representativeId);
    assert.equal(selectError, null);
    assert.equal(selectData?.length, 0, 'RLS sem policy filtra para 0 linhas, nunca expõe o marco real');

    const { error: insertError } = await fx.owner.from('representative_lifecycle_events').insert({
      representative_id: fx.representativeId,
      event_type: 'first_result',
      source: 'forjado',
    });
    assert.ok(insertError, 'INSERT direto deve ser negado');
    assert.equal(insertError!.code, '42501');

    const { error: updateError } = await fx.owner
      .from('representative_lifecycle_events')
      .update({ source: 'adulterado' })
      .eq('representative_id', fx.representativeId);
    assert.equal(updateError, null, 'RLS filtra a linha antes do UPDATE — sucede sem erro, mas afeta 0 linhas');

    const { error: deleteError } = await fx.owner
      .from('representative_lifecycle_events')
      .delete()
      .eq('representative_id', fx.representativeId);
    assert.equal(deleteError, null, 'mesma lógica do UPDATE — filtra antes de apagar, 0 linhas afetadas');

    const realEvents = await eventsFor(fx.representativeId);
    assert.equal(realEvents.length, 1, 'o marco real (representative_registered) continua intacto');
    assert.equal(realEvents[0].source, 'register_representative');
  });
});
