import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * SET-116 — prova as propriedades que `scripts/collect-stage-1-kpis.ts`
 * precisa garantir (`docs/plans/AUDIT_STAGE_1_KPI_HISTORICAL_INTEGRITY_2026-09-01.md`
 * R2/R9): output com timestamp/versão/ambiente presentes, e — a
 * propriedade mais importante — genuinamente read-only.
 *
 * A garantia read-only é provada de duas formas independentes:
 *   1. estaticamente (abaixo, sempre roda): o script nunca importa
 *      `@supabase/supabase-js` nem faz uma chamada HTTP não-GET;
 *   2. dinamicamente: uma linha de `representative_lifecycle_events` criada
 *      por ESTE teste continua byte-a-byte idêntica depois de rodar o
 *      coletor — escopado ao próprio fixture, não a uma contagem global da
 *      tabela, porque `npm run test` roda várias suítes de integração
 *      concorrentemente contra o mesmo banco de desenvolvimento
 *      (`node --test` paraleliza arquivos por padrão) — uma contagem
 *      global mudaria por causa de OUTRAS suítes criando/apagando seus
 *      próprios representantes ao mesmo tempo, não por causa do coletor.
 *
 * Determinismo ("mesma base → mesmos números") é provado separadamente,
 * sem tocar um banco real, em `tests/collect-stage-1-kpis-metrics.test.ts`
 * — a função pura `computeStage1Metrics()` com dados fixos, exatamente
 * pela mesma razão de concorrência acima: comparar duas execuções LIVE
 * deste script contra o banco compartilhado seria inerentemente instável.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createIntegrationServiceRoleClient() : null;

const scriptPath = resolve(process.cwd(), 'scripts/collect-stage-1-kpis.ts');
const createdUserIds: string[] = [];

describe('collect-stage-1-kpis.ts — static read-only guarantee', () => {
  it('never imports @supabase/supabase-js and never issues a non-GET HTTP call or .rpc()', () => {
    const fullSource = readFileSync(scriptPath, 'utf8');
    // Descarta linhas de comentário antes de checar — o cabeçalho deste
    // arquivo cita "@supabase/supabase-js"/".rpc()" em prosa, explicando
    // exatamente por que NÃO são usados aqui.
    const code = fullSource
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/)/.test(line))
      .join('\n');

    assert.doesNotMatch(code, /@supabase\/supabase-js/);
    assert.doesNotMatch(code, /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/i);
    assert.doesNotMatch(code, /\.rpc\(/);
    assert.match(code, /method:\s*'GET'/, 'toda leitura deve ser explicitamente GET');
  });
});

describe('collect-stage-1-kpis.ts — collector output (Postgres, integration)', { skip: !canRun }, () => {
  after(async () => {
    for (const userId of createdUserIds) {
      await service!.auth.admin.deleteUser(userId);
    }
  });

  function runCollector(outDir: string) {
    return spawnSync(
      process.execPath,
      [resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs'), scriptPath, `--out-dir=${outDir}`, '--format=json'],
      { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 30_000 },
    );
  }

  function parseStdoutJson(stdout: string): Record<string, unknown> {
    const start = stdout.indexOf('{');
    assert.ok(start >= 0, `stdout não contém JSON: ${stdout}`);
    return JSON.parse(stdout.slice(start)) as Record<string, unknown>;
  }

  it('produz output com timestamp, spec_version, collector_version e ambiente presentes, e não altera um fixture próprio', async () => {
    // Fixture escopado a este teste — a asserção de "não escreve" compara
    // esta linha específica antes/depois, imune a outras suítes rodando em
    // paralelo contra o mesmo banco.
    const unique = randomUUID();
    const email = `kpi-collector-readonly-${unique}@example.invalid`;
    const { data: userData, error: userError } = await service!.auth.admin.createUser({
      email,
      password: `T3st-${unique}-Aa!`,
      email_confirm: true,
    });
    assert.equal(userError, null);
    createdUserIds.push(userData.user!.id);

    const { error: insertError } = await service!.from('representative_lifecycle_events').insert({
      representative_id: userData.user!.id, // não precisa ser um representative real para este teste de imutabilidade
      event_type: 'representative_registered',
      source: 'collector-readonly-test-fixture',
    });
    assert.equal(insertError, null);

    const before = await service!
      .from('representative_lifecycle_events')
      .select('*')
      .eq('representative_id', userData.user!.id)
      .single();
    assert.equal(before.error, null);

    const outDir = mkdtempSync(join(tmpdir(), 'kpi-collector-test-'));
    try {
      const result = runCollector(outDir);
      assert.equal(result.status, 0, `coletor falhou: ${result.stderr}`);

      const output = parseStdoutJson(result.stdout);
      assert.ok(output.collected_at, 'collected_at ausente');
      assert.equal(output.timezone, 'UTC');
      assert.ok(output.spec_version, 'spec_version ausente (git SHA de STAGE_1_KPI_SPECIFICATION.md)');
      assert.ok(output.collector_version, 'collector_version ausente (git SHA do HEAD)');
      assert.equal(output.environment, 'development', 'ambiente alvo deve ser identificado corretamente');
      assert.ok(output.metrics, 'metrics ausente');

      const after = await service!
        .from('representative_lifecycle_events')
        .select('*')
        .eq('representative_id', userData.user!.id)
        .single();
      assert.equal(after.error, null);
      assert.deepEqual(after.data, before.data, 'a linha do fixture deve continuar byte-a-byte idêntica após o coletor rodar');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
      await service!.from('representative_lifecycle_events').delete().eq('representative_id', userData.user!.id);
    }
  });
});
