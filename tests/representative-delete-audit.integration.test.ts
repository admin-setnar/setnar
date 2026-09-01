import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createIntegrationServiceRoleClient } from './support/service-role-client';

/**
 * Hardening B (docs/plans/AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md
 * §14/§16-§22, migrations `20260909000000`/`20260909000001`): a `DELETE FROM
 * representatives` that actually commits must leave exactly one row in
 * `representative_delete_audit_log`; one that gets rejected by the existing
 * `NO ACTION` FKs on the six child tables must leave none.
 *
 * Fixtures here insert directly into `representatives` via `service`
 * (bypassing `register_representative()`) rather than reusing the pattern
 * from `trial-lifecycle.integration.test.ts` — since `20260901000000`,
 * `register_representative()` always creates a `subscriptions` row
 * atomically, which would make "representative with zero children" (Teste
 * 1 below) unreachable through the real onboarding RPC.
 *
 * Teste 3 from the audit's remediation spec ("rollback não deixa evento
 * persistente") is NOT expressed here as a supabase-js/PostgREST test: each
 * PostgREST call is its own auto-committing transaction — there is no
 * client-side way to issue an explicit `BEGIN`/`ROLLBACK` around a `DELETE`
 * over the stateless REST API this project's write paths use (no `pg`/psql
 * client is part of this codebase). That property was instead verified
 * directly against the disposable `setnar-db-test` project while developing
 * `20260909000000` (`BEGIN; DELETE ...; ROLLBACK;` via raw SQL, confirmed
 * zero audit rows and the representative still present after rollback) —
 * see this hardening's delivery notes. Teste 1/2's coverage below already
 * exercises the same underlying guarantee (statement-level atomicity: the
 * trigger's INSERT and the DELETE it audits always commit or roll back
 * together) for every path this codebase's own write surface can trigger.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publicKey && serviceKey);
const service = canRun ? createIntegrationServiceRoleClient() : null;

const createdUserIds: string[] = [];
const createdRepresentativeIds: string[] = [];

async function igreenCompanyId(): Promise<string> {
  const { data, error } = await service!.from('companies').select('id').eq('slug', 'igreen').single();
  assert.equal(error, null);
  return data!.id as string;
}

interface Fixture {
  readonly userId: string;
  readonly representativeId: string;
  readonly owner: SupabaseClient;
}

/** Cria auth.user + profile (via trigger) + representative — sem filhos, sem passar por register_representative(). */
async function createChildlessRepresentative(prefix: string): Promise<Fixture> {
  const unique = randomUUID();
  const email = `rep-delete-audit-${prefix}-${unique}@example.invalid`;
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

  const { data: rep, error: repError } = await service!
    .from('representatives')
    .insert({
      profile_id: userId,
      company_id: await igreenCompanyId(),
      slug: `rep-delete-audit-${prefix}-${unique}`,
      display_name: `Teste Audit Delete ${prefix}`,
      authorization_id: `rep-delete-audit-${unique}`,
      phone: '+5511988887777',
    })
    .select('id')
    .single();
  assert.equal(repError, null);
  const representativeId = rep!.id as string;
  createdRepresentativeIds.push(representativeId);

  return { userId, representativeId, owner };
}

async function auditRows(representativeId: string) {
  const { data, error } = await service!
    .from('representative_delete_audit_log')
    .select('*')
    .eq('representative_id', representativeId);
  assert.equal(error, null);
  return data!;
}

describe('representative_delete_audit_log (Postgres trigger, integration)', { skip: !canRun }, () => {
  after(async () => {
    // Filhos primeiro (mesma ordem de FK de trial-lifecycle.integration.test.ts),
    // depois representatives ainda vivos (alguns já foram apagados pelos
    // próprios testes — .in() em uma lista vazia/parcial é seguro), depois
    // os auth.users sintéticos.
    if (createdRepresentativeIds.length > 0) {
      await service!.from('product_activations').delete().in('representative_id', createdRepresentativeIds);
      await service!.from('representatives').delete().in('id', createdRepresentativeIds);
    }
    for (const userId of createdUserIds) {
      await service!.auth.admin.deleteUser(userId);
    }
  });

  it('Teste 1 — representative sem filhos: DELETE sucede e grava exatamente 1 linha de auditoria', async () => {
    const fx = await createChildlessRepresentative('t1');

    const { error: deleteError } = await service!.from('representatives').delete().eq('id', fx.representativeId);
    assert.equal(deleteError, null);

    const rows = await auditRows(fx.representativeId);
    assert.equal(rows.length, 1);
    const row = rows[0]!;
    assert.equal(row.representative_id, fx.representativeId);
    assert.equal(row.profile_id, fx.userId);
    assert.ok(row.deleted_at);
    assert.ok(row.pg_txid);
    assert.equal(typeof row.deleted_by_session_user, 'string');

    // já apagado por este teste — não deixar o `after()` tentar de novo.
    createdRepresentativeIds.splice(createdRepresentativeIds.indexOf(fx.representativeId), 1);
  });

  it('Teste 2 — representative com filho (product_activations): DELETE falha por FK, 0 linhas de auditoria, representative e filho preservados', async () => {
    const fx = await createChildlessRepresentative('t2');
    const { data: product, error: productError } = await service!.from('products').select('id').limit(1).single();
    assert.equal(productError, null);

    const { error: activationError } = await service!
      .from('product_activations')
      .insert({ representative_id: fx.representativeId, product_id: product!.id, status: 'draft' });
    assert.equal(activationError, null);

    const { error: deleteError } = await service!.from('representatives').delete().eq('id', fx.representativeId);
    assert.ok(deleteError, 'a FK NO ACTION deve rejeitar o DELETE enquanto o filho existir');
    assert.equal(deleteError!.code, '23503');

    const rows = await auditRows(fx.representativeId);
    assert.equal(rows.length, 0, 'nenhuma auditoria falsa para um DELETE que não foi efetivamente commitado');

    const { data: stillThere, error: readError } = await service!
      .from('representatives')
      .select('id')
      .eq('id', fx.representativeId)
      .maybeSingle();
    assert.equal(readError, null);
    assert.ok(stillThere, 'o representative deve continuar existindo — o DELETE foi rejeitado, não parcialmente aplicado');
  });

  it('Teste 4/5 — um cliente authenticated comum não pode ler, inserir nem alterar a trilha de auditoria', async () => {
    const fx = await createChildlessRepresentative('t45');
    // Deixa uma linha real de auditoria existir (apagando o próprio fixture)
    // para que "SELECT devolve 0 linhas" e "UPDATE afeta 0 linhas" estejam
    // testando RLS de verdade, não apenas a ausência de dados.
    const { error: setupDeleteError } = await service!.from('representatives').delete().eq('id', fx.representativeId);
    assert.equal(setupDeleteError, null);
    createdRepresentativeIds.splice(createdRepresentativeIds.indexOf(fx.representativeId), 1);
    const [auditRow] = await auditRows(fx.representativeId);
    assert.ok(auditRow, 'setup: precisa existir uma linha de auditoria real para os testes de RLS abaixo');

    // SELECT: RLS sem policy filtra em vez de erroar — devolve 0 linhas, não um erro.
    // (verificado ao vivo contra setnar-db-test: `{error: null, dataLength: 0}`)
    const { data: selectData, error: selectError } = await fx.owner
      .from('representative_delete_audit_log')
      .select('*')
      .eq('representative_id', fx.representativeId);
    assert.equal(selectError, null);
    assert.equal(selectData?.length, 0, 'um cliente authenticated comum nunca deve enxergar linhas desta tabela');

    // INSERT: RLS sem policy WITH CHECK rejeita com erro 42501.
    const { error: insertError } = await fx.owner.from('representative_delete_audit_log').insert({
      representative_id: randomUUID(),
      profile_id: fx.userId,
      deleted_by_current_user: 'forjado',
      deleted_by_session_user: 'forjado',
      pg_txid: 1,
    });
    assert.ok(insertError, 'RLS sem policy deve negar INSERT direto a um cliente authenticated comum');
    assert.equal(insertError!.code, '42501');

    // UPDATE: mesma lógica do SELECT — a cláusula USING filtra a linha antes
    // de qualquer alteração, então a chamada "sucede" sem erro, mas afeta 0
    // linhas. A prova real de imutabilidade é reler a linha pelo service_role
    // e confirmar que nada mudou.
    const { error: updateError } = await fx.owner
      .from('representative_delete_audit_log')
      .update({ deleted_by_current_user: 'adulterado' })
      .eq('representative_id', fx.representativeId);
    assert.equal(updateError, null);

    const [rowAfterUpdateAttempt] = await auditRows(fx.representativeId);
    assert.equal(rowAfterUpdateAttempt.deleted_by_current_user, auditRow.deleted_by_current_user);
    assert.notEqual(rowAfterUpdateAttempt.deleted_by_current_user, 'adulterado');
  });
});
