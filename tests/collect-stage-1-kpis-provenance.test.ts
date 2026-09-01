import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveEnvironmentBinding,
  sha256Hex,
  type EnvironmentBindingInput,
} from '../scripts/collect-stage-1-kpis';
import { ALLOWED_TEST_SUPABASE_PROJECT_REFS, PRODUCTION_SUPABASE_PROJECT_REF } from '../scripts/supabase-production-guard.mjs';

/**
 * SET-116 FINAL REVIEW PATCH, Blocker 2/3: prova, sem nenhuma chamada de
 * rede, que (a) a provenance por conteúdo (`sha256Hex`) é determinística e
 * sensível a qualquer byte alterado, e (b) `resolveEnvironmentBinding()`
 * vincula `environment` a um project ref real, falha fechada em
 * desconhecido/mismatch, e nunca é substituível por um rótulo solto.
 */
const DEV_REF = ALLOWED_TEST_SUPABASE_PROJECT_REFS[0]!;

describe('sha256Hex — provenance por conteúdo', () => {
  it('Caso G — mesmo conteúdo produz o mesmo hash, sempre', () => {
    assert.equal(sha256Hex('conteudo-fixo-do-coletor'), sha256Hex('conteudo-fixo-do-coletor'));
  });

  it('Caso E — bytes diferentes do "coletor" produzem hashes diferentes', () => {
    const before = sha256Hex('function collectStage1Kpis() { /* v1 */ }');
    const after = sha256Hex('function collectStage1Kpis() { /* v2, uma linha alterada */ }');
    assert.notEqual(before, after);
  });

  it('Caso F — bytes diferentes da "spec" produzem hashes diferentes', () => {
    const before = sha256Hex('# STAGE_1_KPI_SPECIFICATION.md\nKPI 9 = ...');
    const after = sha256Hex('# STAGE_1_KPI_SPECIFICATION.md\nKPI 9 = ... (definição revisada)');
    assert.notEqual(before, after);
  });

  it('produz um hex de 64 caracteres (SHA-256 real, não um placeholder)', () => {
    assert.match(sha256Hex('qualquer coisa'), /^[0-9a-f]{64}$/);
  });
});

describe('resolveEnvironmentBinding — vínculo ambiente↔project ref (Postgres NUNCA tocado)', () => {
  it('Caso H — production declarado + project ref de produção: ALLOW', () => {
    const result = resolveEnvironmentBinding({
      supabaseUrl: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
      declaredEnvironment: 'production',
    });
    assert.equal(result.verdict, 'ALLOW');
    assert.equal(result.environment, 'production');
    assert.equal(result.projectRef, PRODUCTION_SUPABASE_PROJECT_REF);
  });

  it('Caso I — production declarado + project ref de teste: BLOCK', () => {
    const result = resolveEnvironmentBinding({
      supabaseUrl: `https://${DEV_REF}.supabase.co`,
      declaredEnvironment: 'production',
    });
    assert.equal(result.verdict, 'BLOCK');
    assert.match(result.reason, /não bate/);
  });

  it('Caso J — development declarado + project ref de produção: BLOCK', () => {
    const result = resolveEnvironmentBinding({
      supabaseUrl: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
      declaredEnvironment: 'development',
    });
    assert.equal(result.verdict, 'BLOCK');
    assert.match(result.reason, /não bate/);
  });

  it('Caso K — project ref desconhecido: BLOCK, independentemente de --environment', () => {
    const withoutDeclaration = resolveEnvironmentBinding({ supabaseUrl: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co' });
    assert.equal(withoutDeclaration.verdict, 'BLOCK');
    assert.equal(withoutDeclaration.environment, 'unknown');

    const withDeclaration = resolveEnvironmentBinding({
      supabaseUrl: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
      declaredEnvironment: 'development',
    });
    assert.equal(withDeclaration.verdict, 'BLOCK');
  });

  it('sem --environment declarado: ainda ALLOW/BLOCK corretamente, só pela URL (comportamento pré-existente preservado)', () => {
    const prod = resolveEnvironmentBinding({ supabaseUrl: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co` });
    assert.equal(prod.verdict, 'ALLOW');
    assert.equal(prod.environment, 'production');

    const dev = resolveEnvironmentBinding({ supabaseUrl: `https://${DEV_REF}.supabase.co` });
    assert.equal(dev.verdict, 'ALLOW');
    assert.equal(dev.environment, 'development');
  });

  it('URL ausente ou inválida: BLOCK fail-closed', () => {
    const cases: EnvironmentBindingInput[] = [{ supabaseUrl: undefined }, { supabaseUrl: null }, { supabaseUrl: 'not a url' }];
    for (const input of cases) {
      const result = resolveEnvironmentBinding(input);
      assert.equal(result.verdict, 'BLOCK', `esperava BLOCK para ${JSON.stringify(input)}`);
    }
  });

  it('nunca reaproveita a semântica de bloqueio do guard de teste — resolveEnvironmentBinding permite production por desenho quando o ref bate', () => {
    // Propriedade central do Blocker 3.4: ao contrário de
    // `assertSupabaseIntegrationTargetIsSafe()` (que SEMPRE bloqueia o ref
    // de produção, por ser um guard de teste), este resolvedor permite
    // produção quando é exatamente isso que foi pedido/resolvido — o
    // coletor precisa poder ler produção de verdade.
    const result = resolveEnvironmentBinding({
      supabaseUrl: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
    });
    assert.equal(result.verdict, 'ALLOW');
  });
});
