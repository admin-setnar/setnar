import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * SET-116 FINAL REVIEW PATCH, Blocker 1: prova, contra um Postgres real,
 * a invariável que justifica gravar `first_result` como "primeiro
 * whatsapp_click OU lead da vida do representative" sem precisar ancorá-lo
 * explicitamente em `first_page_published` no momento da escrita.
 *
 * ============================================================================
 * A INVARIÁVEL, e a prova de código/schema que a sustenta (não só produto)
 * ============================================================================
 *
 * `record_whatsapp_click()` e `submit_lead()` (ambas
 * `supabase/migrations/20260910000000_add_representative_lifecycle_events.sql`,
 * corpo herdado sem mudança de `20260810000000`/`20260801000000`) só
 * inserem em `analytics_events`/`leads` depois de checar
 * `private.is_page_publicly_accessible(representative_id, product_id)`
 * (`20260817000000`), cuja definição É, literalmente:
 *
 *   select private.page_publication_blocker(...) is null
 *     and exists (
 *       select 1 from product_activations pa
 *       where pa.representative_id = ... and pa.product_id = ...
 *         and pa.status = 'published'
 *     );
 *
 * — uma leitura AO VIVO de `product_activations.status = 'published'` no
 * exato momento da chamada, nunca um valor cacheado. Nenhum outro caminho
 * de escrita alcança `analytics_events`/`leads`: confirmado nesta mesma
 * investigação que `leads` tem GRANT INSERT para `anon`/`authenticated`
 * mas ZERO policy de INSERT (RLS nega na prática — testado ao vivo,
 * `42501`), e `analytics_events` não tem GRANT de INSERT para nenhum papel
 * além de `service_role`/`postgres`.
 *
 * Portanto: para `analytics_events`/`leads` receber uma linha para um
 * representante, `product_activations.status` PRECISA estar `'published'`
 * naquele instante — o que só é possível depois que a transição
 * `draft→published` (ou `unpublished→published`) já COMITOU. A primeira
 * dessas transições é exatamente o que `set_activation_status()` grava
 * como `first_page_published` (`on conflict do nothing`, uma vez só, por
 * representante). Como as duas escritas acontecem no MESMO banco Postgres
 * primário (sem réplica, sem cache), com um único relógio e visibilidade
 * read-committed, `first_result.occurred_at` — quando existe — é sempre
 * POSTERIOR a `first_page_published.occurred_at`. Não é possível, com o
 * schema/RPCs atuais, um resultado válido nascer antes da primeira
 * publicação.
 *
 * Isso torna `first_result` (o marco atual, sem mudança de nome/lógica)
 * semanticamente equivalente a "primeiro resultado qualificável depois da
 * primeira publicação" para este modelo — não por coincidência, mas porque
 * a única porta de entrada para um resultado já exige a página estar
 * publicada. A janela de 30 dias do KPI 9 oficial continua sendo aplicada
 * no COLETOR (`computeStage1Metrics`, comparando os dois timestamps
 * imutáveis), não na escrita — o marco captura "aconteceu alguma vez",
 * a janela decide se conta como "resultado" para o KPI.
 *
 * ============================================================================
 * Janela "≤30 dias" — sem ambiguidade a resolver
 * ============================================================================
 *
 * `STAGE_1_KPI_SPECIFICATION.md` KPI 9 (D2) usa literalmente "≤30 dias" —
 * inclusive de exatamente 30 dias corridos, não um recorte de calendário
 * nem timezone local (todo timestamp envolvido é `timestamptz`, comparado
 * em `computeStage1Metrics` via `.getTime()`, epoch — UTC por construção,
 * nunca timezone local). `<= days(30)` no coletor já implementa isso
 * literalmente. Nenhuma decisão de produto nova foi tomada aqui.
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
  const email = `kpi9-semantics-${prefix}-${unique}@example.invalid`;
  const password = `T3st-${unique}-Aa!`;
  const { data: userData, error: userError } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(userError, null);
  const userId = userData.user!.id;
  createdUserIds.push(userId);

  const owner = createClient(url!, publicKey!, { auth: { persistSession: false } });
  const { error: signInError } = await owner.auth.signInWithPassword({ email, password });
  assert.equal(signInError, null);

  const { data: registered, error: registerError } = await owner.rpc('register_representative', {
    p_slug: `kpi9-semantics-${prefix}-${unique}`,
    p_display_name: `Teste KPI9 ${prefix}`,
    p_authorization_id: `kpi9-${unique}`,
    p_phone: '+5511988887777',
    p_city: null,
  });
  assert.equal(registerError, null);
  assert.equal(registered?.[0]?.status, 'created');

  return { userId, representativeId: registered![0]!.representative_id as string, owner };
}

async function firstIgreenProduct(): Promise<{ id: string; slug: string }> {
  const { data, error } = await service!.from('products').select('id, slug').limit(1).single();
  assert.equal(error, null);
  return data as { id: string; slug: string };
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

describe('KPI 9 result semantics — first_result nunca precede first_page_published (Postgres, integration)', { skip: !canRun }, () => {
  after(async () => {
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
    for (const userId of createdUserIds) await service!.auth.admin.deleteUser(userId);
  });

  it('Caso A — página nunca publicada (draft): clique e lead são recusados, nenhum first_result nasce', async () => {
    const fx = await registerFreshRepresentative('a');
    const product = await firstIgreenProduct();
    const { error: activateError } = await fx.owner.rpc('activate_product', { p_product_id: product.id });
    assert.equal(activateError, null);
    // Deliberadamente NUNCA publicado — status continua 'draft'.

    const { data: repRow } = await service!.from('representatives').select('slug').eq('id', fx.representativeId).single();

    const { data: clickResult, error: clickError } = await service!.rpc('record_whatsapp_click', {
      p_representative_slug: repRow!.slug,
      p_product_slug: product.slug,
      p_referrer: null,
      p_ip_hash: `kpi9-a-click-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0 (integration-test)',
    });
    assert.equal(clickError, null);
    assert.equal(clickResult, false, 'record_whatsapp_click deve recusar (retornar false) para uma página em draft');

    const { data: leadResult, error: leadError } = await service!.rpc('submit_lead', {
      p_representative_id: fx.representativeId,
      p_product_id: product.id,
      p_telefone_e164: '+5511977776666',
      p_nome: 'Teste KPI9 Caso A',
      p_cidade: null,
      p_email: null,
      p_origem: null,
      p_referrer: null,
      p_ip_hash: `kpi9-a-lead-${randomUUID()}`,
    });
    assert.equal(leadError, null);
    assert.equal(leadResult, false, 'submit_lead deve recusar (retornar false) para uma página em draft');

    const { count: analyticsCount } = await service!
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('representative_id', fx.representativeId);
    assert.equal(analyticsCount, 0, 'nenhuma linha de analytics_events deve existir');

    const { count: leadsCount } = await service!
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('representative_id', fx.representativeId);
    assert.equal(leadsCount, 0, 'nenhuma linha de leads deve existir');

    const events = await eventsFor(fx.representativeId);
    assert.equal(
      events.filter((e) => e.event_type === 'first_result').length,
      0,
      'nenhum first_result deve existir sem nenhuma publicação',
    );
    assert.equal(
      events.filter((e) => e.event_type === 'first_page_published').length,
      0,
      'nenhum first_page_published deve existir — a página nunca foi publicada',
    );
  });

  it('Caso B — primeira publicação seguida de resultado válido grava o marco correto', async () => {
    const fx = await registerFreshRepresentative('b');
    const product = await firstIgreenProduct();
    await fx.owner.rpc('activate_product', { p_product_id: product.id });
    const { error: publishError } = await fx.owner.rpc('set_activation_status', {
      p_product_id: product.id,
      p_status: 'published',
    });
    assert.equal(publishError, null);

    const { data: repRow } = await service!.from('representatives').select('slug').eq('id', fx.representativeId).single();
    const { data: clickOk, error: clickError } = await service!.rpc('record_whatsapp_click', {
      p_representative_slug: repRow!.slug,
      p_product_slug: product.slug,
      p_referrer: null,
      p_ip_hash: `kpi9-b-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0 (integration-test)',
    });
    assert.equal(clickError, null);
    assert.equal(clickOk, true);

    const events = await eventsFor(fx.representativeId);
    const publish = events.find((e) => e.event_type === 'first_page_published');
    const result = events.find((e) => e.event_type === 'first_result');
    assert.ok(publish, 'first_page_published deve existir');
    assert.ok(result, 'first_result deve existir');
    assert.ok(
      new Date(result!.occurred_at).getTime() >= new Date(publish!.occurred_at).getTime(),
      'first_result nunca deve preceder first_page_published — a invariável provada no cabeçalho deste arquivo',
    );
  });

  it('Caso C — republish não move o anchor de first_page_published (mesmo comportamento já provado em representative-lifecycle-events, reafirmado aqui no contexto de KPI 9)', async () => {
    const fx = await registerFreshRepresentative('c');
    const product = await firstIgreenProduct();
    await fx.owner.rpc('activate_product', { p_product_id: product.id });
    await fx.owner.rpc('set_activation_status', { p_product_id: product.id, p_status: 'published' });

    const beforeEvents = await eventsFor(fx.representativeId);
    const originalPublishedAt = beforeEvents.find((e) => e.event_type === 'first_page_published')!.occurred_at;

    await fx.owner.rpc('set_activation_status', { p_product_id: product.id, p_status: 'unpublished' });
    await fx.owner.rpc('set_activation_status', { p_product_id: product.id, p_status: 'published' });

    const afterEvents = await eventsFor(fx.representativeId);
    const publishEvents = afterEvents.filter((e) => e.event_type === 'first_page_published');
    assert.equal(publishEvents.length, 1);
    assert.equal(publishEvents[0].occurred_at, originalPublishedAt);
  });

  it('Caso D — tentativa de resultado antes de publicar (recusada) seguida de resultado real após publicar: KPI 9 permanece correto', async () => {
    const fx = await registerFreshRepresentative('d');
    const product = await firstIgreenProduct();
    await fx.owner.rpc('activate_product', { p_product_id: product.id });

    const { data: repRow } = await service!.from('representatives').select('slug').eq('id', fx.representativeId).single();

    // Tentativa ANTES de publicar — deve ser recusada (Caso A reafirmado).
    const { data: earlyClick } = await service!.rpc('record_whatsapp_click', {
      p_representative_slug: repRow!.slug,
      p_product_slug: product.slug,
      p_referrer: null,
      p_ip_hash: `kpi9-d-early-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0 (integration-test)',
    });
    assert.equal(earlyClick, false);

    // Agora publica de verdade, e um resultado real acontece depois.
    await fx.owner.rpc('set_activation_status', { p_product_id: product.id, p_status: 'published' });
    const { data: realClick } = await service!.rpc('record_whatsapp_click', {
      p_representative_slug: repRow!.slug,
      p_product_slug: product.slug,
      p_referrer: null,
      p_ip_hash: `kpi9-d-real-${randomUUID()}`,
      p_user_agent: 'Mozilla/5.0 (integration-test)',
    });
    assert.equal(realClick, true);

    const events = await eventsFor(fx.representativeId);
    const resultEvents = events.filter((e) => e.event_type === 'first_result');
    assert.equal(resultEvents.length, 1, 'exatamente um first_result — a tentativa recusada nunca contou');
    const publish = events.find((e) => e.event_type === 'first_page_published')!;
    assert.ok(new Date(resultEvents[0].occurred_at).getTime() >= new Date(publish.occurred_at).getTime());

    const { count: analyticsCount } = await service!
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('representative_id', fx.representativeId);
    assert.equal(analyticsCount, 1, 'só o clique real (pós-publicação) foi persistido — a tentativa recusada não gravou linha nenhuma');
  });
});
