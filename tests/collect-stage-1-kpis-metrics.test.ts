import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeStage1Metrics, type Stage1MetricsInput } from '../scripts/collect-stage-1-kpis';

/**
 * SET-116 — prova "mesma base → mesmos números" (§24) sem tocar um banco
 * real: `computeStage1Metrics()` é pura, então dados fixos + `now` fixo
 * devem sempre produzir a mesma saída, determinística por construção, sem
 * depender de nenhuma suíte de integração concorrente não escrever na
 * mesma base ao mesmo tempo (ver o comentário de
 * `tests/collect-stage-1-kpis.integration.test.ts` sobre por que uma
 * comparação live seria instável).
 */
const NOW = new Date('2026-09-15T00:00:00.000Z').getTime();

const REP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const REP_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const REP_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const PRODUCT_1 = '11111111-1111-1111-1111-111111111111';

function baseInput(overrides: Partial<Stage1MetricsInput> = {}): Stage1MetricsInput {
  return {
    lifecycleEvents: [
      { representative_id: REP_A, event_type: 'representative_registered', occurred_at: '2026-08-01T00:00:00Z' },
      { representative_id: REP_A, event_type: 'first_page_published', occurred_at: '2026-08-02T00:00:00Z' },
      { representative_id: REP_A, event_type: 'first_result', occurred_at: '2026-08-10T00:00:00Z' }, // 8 dias -> dentro de 30d
      { representative_id: REP_B, event_type: 'representative_registered', occurred_at: '2026-08-05T00:00:00Z' },
      { representative_id: REP_B, event_type: 'first_page_published', occurred_at: '2026-08-05T00:00:00Z' },
      { representative_id: REP_B, event_type: 'first_result', occurred_at: '2026-09-10T00:00:00Z' }, // >30d depois de publicar
      { representative_id: REP_C, event_type: 'representative_registered', occurred_at: '2026-08-20T00:00:00Z' },
      // REP_C nunca publicou — não deve entrar no numerador/denominador de KPI 9.
    ],
    activations: [
      { representative_id: REP_A, product_id: PRODUCT_1, status: 'published', published_at: '2026-08-02T00:00:00Z' },
      { representative_id: REP_B, product_id: PRODUCT_1, status: 'published', published_at: '2026-08-05T00:00:00Z' },
    ],
    analyticsEvents: [
      { representative_id: REP_A, event_type: 'visit', created_at: '2026-09-01T00:00:00Z' },
      { representative_id: REP_A, event_type: 'whatsapp_click', created_at: '2026-08-10T00:00:00Z' },
    ],
    leads: [{ representative_id: REP_B, created_at: '2026-09-10T00:00:00Z' }],
    subscriptions: [
      { representative_id: REP_A, status: 'active', provider: 'asaas', amount_cents: 2790, updated_at: '2026-08-15T00:00:00Z' },
      { representative_id: REP_B, status: 'trialing', provider: 'trial', amount_cents: null, updated_at: '2026-08-05T00:00:00Z' },
    ],
    feedback: [
      { context: 'value_perception', response: 'yes', answered_at: '2026-08-20T00:00:00Z' },
      { context: 'value_perception', response: 'partly', answered_at: null },
      { context: 'cancellation', response: 'price', answered_at: '2026-08-25T00:00:00Z' },
    ],
    representativesCount: 3,
    now: NOW,
    ...overrides,
  };
}

describe('computeStage1Metrics — determinismo (mesma base → mesmos números)', () => {
  it('produz exatamente o mesmo objeto em duas chamadas com a mesma entrada', () => {
    const first = computeStage1Metrics(baseInput());
    const second = computeStage1Metrics(baseInput());
    assert.deepEqual(first, second);
  });

  it('KPI 1 — conta representative_registered e cruza contra representatives', () => {
    const result = computeStage1Metrics(baseInput()) as any;
    assert.equal(result.kpi1_registered_representatives.value, 3);
    assert.equal(result.kpi1_registered_representatives.cross_check_current_representatives_count, 3);
    assert.equal(result.kpi1_registered_representatives.cross_check_matches, true);
  });

  it('KPI 2 — conta first_page_published, não confunde com representative_registered', () => {
    const result = computeStage1Metrics(baseInput()) as any;
    assert.equal(result.kpi2_activated_representative_lifetime.value, 2); // A e B, não C
    assert.equal(result.kpi2_activation_rate_pct, 66.67);
  });

  it('KPI 9 — janela de 30 dias ancorada em first_page_published, não em published_at bruto', () => {
    const result = computeStage1Metrics(baseInput()) as any;
    // Só REP_A teve resultado dentro de 30 dias da própria publicação
    // (REP_B teve resultado, mas >30 dias depois; REP_C nunca publicou).
    assert.equal(result.kpi9_representative_with_result.numerator_result_within_30d_of_first_publish, 1);
    assert.equal(result.kpi9_representative_with_result.denominator_activated, 2);
    assert.equal(result.kpi9_representative_with_result.result_rate_pct, 50);
    assert.equal(result.kpi9_representative_with_result.lifetime_with_result_ever, 2, 'A e B tiveram resultado alguma vez, mesmo que fora da janela de 30d');
  });

  it('KPI 10/11 — Paid Customer exige status=active E provider=asaas, nunca só um dos dois', () => {
    const result = computeStage1Metrics(baseInput()) as any;
    assert.equal(result.kpi10_paid_customer.value, 1); // só REP_A: active+asaas
    assert.equal(result.mrr_reais, 27.9);
    assert.equal(result.kpi11_paid_conversion_rate.paid_conversion_rate_pct, 33.33);
  });

  it('KPI 14/15 — só respostas com answered_at contam; "partly" nunca conta como positivo isolado', () => {
    const result = computeStage1Metrics(baseInput()) as any;
    assert.deepEqual(result.kpi14_feedback_distribution, {
      'value_perception:yes': 1,
      'cancellation:price': 1,
    });
    assert.deepEqual(result.kpi15_cancellation_reasons, { price: 1 });
  });

  it('cross_check_matches vira false quando um representative foi apagado sem o lifecycle event correspondente sumir junto', () => {
    // Simula exatamente o cenário do incidente original: representative
    // apagado, o marco lifetime sobrevive — a checagem cruzada deve
    // sinalizar a divergência, não escondê-la.
    const result = computeStage1Metrics(baseInput({ representativesCount: 2 })) as any;
    assert.equal(result.kpi1_registered_representatives.value, 3);
    assert.equal(result.kpi1_registered_representatives.cross_check_current_representatives_count, 2);
    assert.equal(result.kpi1_registered_representatives.cross_check_matches, false);
  });
});
