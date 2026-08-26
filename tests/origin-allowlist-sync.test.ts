import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import { ORIGIN_IDS } from '@/modules/analytics/domain/origin';

/**
 * SET-84 D3 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md) — `ORIGIN_IDS`
 * (TypeScript) é a fonte canônica da allowlist de origem; a allowlist SQL
 * (`is_valid_origin` + as duas `check` constraints) é escrita à mão nas
 * migrations, porque SQL não importa TS. Este teste é o mecanismo que o
 * plano exige para fechar esse risco: falha se a lista TypeScript e a lista
 * hardcoded em SQL divergirem, em vez de depender de alguém lembrar de
 * atualizar as duas manualmente quando uma origem nova entrar.
 */
const EXPECTED_SQL_LIST = "'instagram_post', 'instagram_story', 'whatsapp', 'qrcode', 'direct'";

const analyticsEventsMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260908000000_add_origin_to_analytics_events.sql'),
  'utf8',
);
const leadsMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260908000001_add_origin_to_leads.sql'),
  'utf8',
);
const writeFunctionsMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260908000002_add_origin_write_functions.sql'),
  'utf8',
);

describe('SET-84 D3 origin allowlist — TypeScript/SQL sync', () => {
  it('ORIGIN_IDS matches the SQL allowlist literal used everywhere below', () => {
    assert.equal(ORIGIN_IDS.map((id) => `'${id}'`).join(', '), EXPECTED_SQL_LIST);
  });

  it('has exactly 5 origins, no duplicates', () => {
    assert.equal(ORIGIN_IDS.length, 5);
    assert.equal(new Set(ORIGIN_IDS).size, 5);
  });

  it('analytics_events_origin_check uses the same allowlist as ORIGIN_IDS', () => {
    assert.match(
      analyticsEventsMigration,
      new RegExp(`check \\(origin is null or origin in \\(${EXPECTED_SQL_LIST.replace(/[()]/g, '\\$&')}\\)\\)`),
    );
  });

  it('leads_origin_check uses the same allowlist as ORIGIN_IDS', () => {
    assert.match(
      leadsMigration,
      new RegExp(`check \\(origin is null or origin in \\(${EXPECTED_SQL_LIST.replace(/[()]/g, '\\$&')}\\)\\)`),
    );
  });

  it('is_valid_origin uses the same allowlist as ORIGIN_IDS', () => {
    assert.match(
      writeFunctionsMigration,
      new RegExp(`p_origin in \\(${EXPECTED_SQL_LIST.replace(/[()]/g, '\\$&')}\\)`),
    );
  });

  it('record_page_visit, record_whatsapp_click and submit_lead all accept p_origin with a null default', () => {
    for (const fn of ['record_page_visit', 'record_whatsapp_click']) {
      const start = writeFunctionsMigration.indexOf(`create or replace function public.${fn}(`);
      assert.ok(start > 0, `${fn} definition not found`);
      const body = writeFunctionsMigration.slice(start, start + 400);
      assert.match(body, /p_origin text default null/);
    }

    const submitLeadStart = writeFunctionsMigration.indexOf('create or replace function public.submit_lead(');
    assert.ok(submitLeadStart > 0, 'submit_lead definition not found');
    const submitLeadHeader = writeFunctionsMigration.slice(submitLeadStart, submitLeadStart + 500);
    assert.match(submitLeadHeader, /p_origin\s+text default null/);
  });

  it('keeps p_origin separate from p_origem in submit_lead — both params, both columns, on the same INSERT', () => {
    const insertIndex = writeFunctionsMigration.indexOf('insert into public.leads');
    assert.ok(insertIndex > 0);
    const insertStatement = writeFunctionsMigration.slice(insertIndex, insertIndex + 400);
    assert.match(insertStatement, /campos, origem, referrer, origin\)/);
    assert.match(insertStatement, /p_origem,\s*\n\s*p_referrer,\s*\n\s*v_origin/);
  });

  it('degrades an invalid or missing origin to null instead of rejecting the write', () => {
    assert.match(
      writeFunctionsMigration,
      /v_origin := case when public\.is_valid_origin\(p_origin\) then p_origin else null end;/g,
    );
    const occurrences = writeFunctionsMigration.match(
      /v_origin := case when public\.is_valid_origin\(p_origin\) then p_origin else null end;/g,
    );
    assert.equal(occurrences?.length, 3, 'expected the degrade-to-null pattern in all three functions');
  });

  it('drops the previous signature of each function before recreating it with p_origin', () => {
    assert.match(writeFunctionsMigration, /drop function if exists public\.record_page_visit\(text, text, text, text, text\);/);
    assert.match(writeFunctionsMigration, /drop function if exists public\.record_whatsapp_click\(text, text, text, text, text\);/);
    assert.match(
      writeFunctionsMigration,
      /drop function if exists public\.submit_lead\(uuid, uuid, text, text, text, text, text, text, text\);/,
    );
  });

  it('grants the new 6-arg/10-arg signatures to service_role only', () => {
    assert.match(
      writeFunctionsMigration,
      /grant execute on function public\.record_page_visit\(text, text, text, text, text, text\) to service_role;/,
    );
    assert.match(
      writeFunctionsMigration,
      /grant execute on function public\.record_whatsapp_click\(text, text, text, text, text, text\) to service_role;/,
    );
    assert.match(
      writeFunctionsMigration,
      /grant execute on function public\.submit_lead\(\s*\n\s*uuid, uuid, text, text, text, text, text, text, text, text\s*\n\s*\) to service_role;/,
    );
  });
});
