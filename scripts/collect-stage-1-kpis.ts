/**
 * SET-116 — coletor canônico e versionado dos KPIs oficiais do Stage 1
 * (`docs/plans/STAGE_1_KPI_SPECIFICATION.md`), substituindo o processo
 * anterior ("SQL ad hoc colado no SQL Editor",
 * `docs/runbooks/PILOT_METRICS.md`), a causa raiz apontada em
 * `docs/plans/AUDIT_STAGE_1_KPI_HISTORICAL_INTEGRITY_2026-09-01.md` R2/R9
 * para "nenhum snapshot tem query/versão/timestamp registrados".
 *
 * READ-ONLY por construção, não por disciplina: toda leitura usa `fetch()`
 * com método GET cru contra a API REST (PostgREST) — nunca o cliente
 * `@supabase/supabase-js` (que também expõe `.insert()`/`.update()`/
 * `.delete()`/`.rpc()` de escrita) — mutação é estruturalmente impossível
 * aqui, mesmo padrão já usado nas duas investigações read-only anteriores
 * (`docs/plans/AUDIT_PROFILE_REPRESENTATIVE_INTEGRITY_2026-09-01.md`,
 * `docs/plans/AUDIT_STAGE_1_KPI_HISTORICAL_INTEGRITY_2026-09-01.md`).
 *
 * Por que `service_role`, não uma credencial mais restrita: RLS neste
 * projeto escopa toda leitura de `representatives`/`product_activations`/
 * `analytics_events`/`leads`/`subscriptions`/`feedback_responses`/
 * `representative_lifecycle_events` à própria linha do chamador
 * (`*_select_own`) — a chave publicável (`anon`/`authenticated`) não
 * alcança uma contagem agregada entre representantes. Não existe hoje,
 * neste projeto, um papel de leitura dedicado que bypassa RLS sem também
 * poder escrever (`docs/plans/ANALYTICS_DATA_LAYER_METABASE_READINESS.md`
 * D8-D12 propõe um `bi_readonly`, mas isso está formalmente pendente de um
 * "security POC" — D11 — e não foi implementado; introduzi-lo está fora do
 * escopo desta tarefa). `service_role` é a única credencial capaz de ler
 * através de todos os representantes hoje — o GET-only acima é o que torna
 * seguro usá-la aqui mesmo assim.
 *
 * `computeStage1Metrics()` abaixo é uma função pura (mesma entrada, mesma
 * saída, sem I/O) de propósito — `main()` só busca dados e escreve o
 * arquivo; toda a lógica de agregação é testável em isolamento, sem tocar
 * um banco real, e sem depender de nenhuma outra suíte de integração não
 * escrever na mesma base concorrentemente (`tests/collect-stage-1-kpis-metrics.test.ts`).
 *
 * Uso:
 *   npm run kpis:collect [-- --format=json|markdown|both] [--out-dir=docs/metrics/snapshots] [--environment=production|development]
 *
 * `--environment`, quando passado, é uma AFIRMAÇÃO que precisa bater com o
 * que `NEXT_PUBLIC_SUPABASE_URL` resolve de verdade
 * (`resolveEnvironmentBinding()` abaixo) — um mismatch aborta antes de
 * qualquer leitura, para nunca produzir um snapshot rotulado "production"
 * enquanto a URL aponta para o projeto de teste (ou vice-versa). Sem essa
 * flag, o ambiente é só derivado da URL (ainda fail-closed contra um
 * project ref desconhecido).
 *
 * Nunca aceita `--apply`, nunca precisa de um: não existe nada para
 * aplicar — a única saída é um arquivo local novo.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  ALLOWED_TEST_SUPABASE_PROJECT_REFS,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from './supabase-production-guard.mjs';

export interface LifecycleEventRow {
  representative_id: string;
  event_type: 'representative_registered' | 'first_page_published' | 'first_result';
  occurred_at: string;
}
export interface ActivationRow {
  representative_id: string;
  product_id: string;
  status: 'draft' | 'published' | 'unpublished';
  published_at: string | null;
}
export interface AnalyticsRow {
  representative_id: string;
  event_type: 'visit' | 'whatsapp_click';
  created_at: string;
}
export interface LeadRow {
  representative_id: string;
  created_at: string;
}
export interface SubscriptionRow {
  representative_id: string;
  status: string;
  provider: string;
  amount_cents: number | null;
  updated_at: string;
}
export interface FeedbackRow {
  context: string;
  response: string | null;
  answered_at: string | null;
}

export interface Stage1MetricsInput {
  readonly lifecycleEvents: readonly LifecycleEventRow[];
  readonly activations: readonly ActivationRow[];
  readonly analyticsEvents: readonly AnalyticsRow[];
  readonly leads: readonly LeadRow[];
  readonly subscriptions: readonly SubscriptionRow[];
  readonly feedback: readonly FeedbackRow[];
  readonly representativesCount: number;
  /** Injetável para determinismo em teste — `Date.now()` em produção. */
  readonly now: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function groupCount<T>(rows: readonly T[], keyOf: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = keyOf(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Pura: mesma entrada sempre produz a mesma saída, sem relógio implícito
 * (`now` é um parâmetro, não `Date.now()` direto) e sem I/O. Todas as
 * fórmulas espelham `docs/plans/STAGE_1_KPI_SPECIFICATION.md` literalmente
 * — ver o comentário de cada bloco para qual KPI/decisão (D1/D2/D6/D7) ele
 * implementa.
 */
export function computeStage1Metrics(input: Stage1MetricsInput): Record<string, unknown> {
  const { lifecycleEvents, activations, analyticsEvents, leads, subscriptions, feedback, representativesCount, now } = input;
  const days = (n: number) => n * 24 * 3600 * 1000;
  const since = (n: number) => new Date(now - days(n)).toISOString();

  // KPI 1 — Registered Representatives. Fonte primária:
  // representative_lifecycle_events (o fato persistido, sobrevive a um
  // representative apagado depois); cross-check contra representatives
  // (estado atual) — divergência é sinal de um DELETE que não deveria ter
  // acontecido sem deixar rastro em nenhum dos dois lados. Numa base de
  // teste com muito churn de fixtures (criação+DELETE constante), uma
  // divergência é esperada e não indica um problema — ver o README do
  // diretório de snapshots.
  const registeredEvents = lifecycleEvents.filter((e) => e.event_type === 'representative_registered');
  const kpi1 = {
    formula: "count(representative_lifecycle_events where event_type='representative_registered')",
    value: registeredEvents.length,
    cross_check_current_representatives_count: representativesCount,
    cross_check_matches: registeredEvents.length === representativesCount,
  };

  // KPI 2 — Activated Representative (B, oficial, lifetime, D1). Fonte
  // primária: representative_lifecycle_events (first_page_published);
  // cross-check contra product_activations.status in (published,unpublished).
  const firstPublishedEvents = lifecycleEvents.filter((e) => e.event_type === 'first_page_published');
  const activatedLifetimeCrossCheck = new Set(
    activations.filter((a) => a.status === 'published' || a.status === 'unpublished').map((a) => a.representative_id),
  );
  const kpi2 = {
    formula: "count(distinct representative_lifecycle_events where event_type='first_page_published')",
    value: firstPublishedEvents.length,
    cross_check_product_activations_count: activatedLifetimeCrossCheck.size,
    cross_check_matches: firstPublishedEvents.length === activatedLifetimeCrossCheck.size,
  };
  const kpi2ActivationRatePct = kpi1.value > 0 ? round2((kpi2.value / kpi1.value) * 100) : null;

  // KPI 2A / KPI 3 — snapshot, estado atual, não afetado por esta migration.
  const publishedNow = activations.filter((a) => a.status === 'published');
  const kpi3PublishedPages = publishedNow.length;

  // KPI 4 — Product/Template Adoption.
  const adoptionByProduct = groupCount(activations, (a) => a.product_id);
  const publicationByProduct = groupCount(publishedNow, (a) => a.product_id);

  // KPI 5/6/7/8 — Page Views / Traffic / WhatsApp Clicks / Leads, all-time
  // e janela de 30 dias (o produto expõe só 7|30 hoje — 30 aqui, mesma
  // janela oficial de KPI 9).
  const visits = analyticsEvents.filter((e) => e.event_type === 'visit');
  const clicks = analyticsEvents.filter((e) => e.event_type === 'whatsapp_click');
  const window30 = since(30);
  const kpi5 = { alltime: visits.length, last_30_days: visits.filter((v) => v.created_at >= window30).length };
  const kpi6 = {
    last_30_days: new Set(visits.filter((v) => v.created_at >= window30).map((v) => v.representative_id)).size,
  };
  const kpi7 = { alltime: clicks.length, last_30_days: clicks.filter((c) => c.created_at >= window30).length };
  const kpi8 = { alltime: leads.length, last_30_days: leads.filter((l) => l.created_at >= window30).length };

  // KPI 9 — Representative With Result (D2, oficial): janela de 30 dias
  // ancorada em `published_at`. Calculada a partir de DOIS timestamps
  // imutáveis (first_page_published/first_result), não mais do
  // `published_at` mutável de uma linha de product_activations — a
  // correção central desta tarefa (R4 do audit).
  //
  // Por que `first_result` (não um `first_qualifying_result` separado):
  // provado por código/schema, não só por raciocínio de produto — ver
  // `tests/kpi9-result-semantics.integration.test.ts` — que
  // `record_whatsapp_click()`/`submit_lead()` só inserem depois de
  // `private.is_page_publicly_accessible()` confirmar
  // `product_activations.status = 'published'` NAQUELE INSTANTE, e que
  // nenhum outro caminho de escrita alcança `analytics_events`/`leads`
  // (RLS nega INSERT direto mesmo onde o GRANT existe). Logo
  // `first_result.occurred_at`, quando existe, é sempre >=
  // `first_page_published.occurred_at` — o marco já é, por construção,
  // "o primeiro resultado depois da primeira publicação". A janela de 30
  // dias abaixo é aplicada aqui, na leitura, não na escrita.
  // "<= 30 dias" é literal e inclusivo (STAGE_1_KPI_SPECIFICATION.md KPI 9,
  // D2) — sem ambiguidade de fuso (todo timestamp é timestamptz, comparado
  // via epoch/.getTime(), nunca hora local).
  const firstPublishByRep = new Map(firstPublishedEvents.map((e) => [e.representative_id, e.occurred_at]));
  const firstResultByRep = new Map(
    lifecycleEvents.filter((e) => e.event_type === 'first_result').map((e) => [e.representative_id, e.occurred_at]),
  );
  let resultWithin30d = 0;
  for (const [repId, publishedAt] of firstPublishByRep.entries()) {
    const resultAt = firstResultByRep.get(repId);
    if (!resultAt) continue;
    const withinWindow = new Date(resultAt).getTime() - new Date(publishedAt).getTime() <= days(30);
    if (withinWindow) resultWithin30d++;
  }
  const kpi9 = {
    formula:
      'count(representatives where first_result.occurred_at - first_page_published.occurred_at <= 30 days) / count(activated)',
    numerator_result_within_30d_of_first_publish: resultWithin30d,
    denominator_activated: kpi2.value,
    result_rate_pct: kpi2.value > 0 ? round2((resultWithin30d / kpi2.value) * 100) : null,
    lifetime_with_result_ever: firstResultByRep.size,
  };

  // KPI 10/11/11b/MRR — Paid Customer, snapshot.
  const paidCustomers = subscriptions.filter((s) => s.status === 'active' && s.provider === 'asaas');
  const kpi10 = { value: paidCustomers.length };
  const kpi11 = { paid_conversion_rate_pct: kpi1.value > 0 ? round2((kpi10.value / kpi1.value) * 100) : null };
  const kpi11b = { founding_cohort_conversion: `${kpi10.value}/30`, pct: round2((kpi10.value / 30) * 100) };
  const mrr = round2(paidCustomers.reduce((sum, s) => sum + (s.amount_cents ?? 0), 0) / 100);

  // KPI 12 — Cancellations (snapshot count, known limitation per D4).
  const canceled = subscriptions.filter((s) => s.status === 'canceled');
  const kpi12 = { value: canceled.length, known_limitation: 'app-driven cancellations only (D4, P1 follow-up)' };

  // KPI 13 — Retention D30/D60 (D7, aproximado por updated_at).
  const d30Eligible = subscriptions.filter((s) => s.status !== 'trialing' && new Date(s.updated_at).getTime() <= now - days(30));
  const d60Eligible = subscriptions.filter((s) => s.status !== 'trialing' && new Date(s.updated_at).getTime() <= now - days(60));
  const kpi13 = {
    d30_eligible: d30Eligible.length,
    d30_retained: d30Eligible.filter((s) => s.status === 'active').length,
    d60_eligible: d60Eligible.length,
    d60_retained: d60Eligible.filter((s) => s.status === 'active').length,
  };

  // KPI 14/15 — Feedback.
  const answeredFeedback = feedback.filter((f) => f.answered_at !== null);
  const kpi14 = groupCount(answeredFeedback, (f) => `${f.context}:${f.response}`);
  const cancellationReasons = groupCount(
    answeredFeedback.filter((f) => f.context === 'cancellation'),
    (f) => f.response ?? 'unknown',
  );

  return {
    kpi1_registered_representatives: kpi1,
    kpi2_activated_representative_lifetime: kpi2,
    kpi2_activation_rate_pct: kpi2ActivationRatePct,
    kpi3_published_pages: kpi3PublishedPages,
    kpi4_adoption_by_product: adoptionByProduct,
    kpi4_publication_by_product: publicationByProduct,
    kpi5_page_views: kpi5,
    kpi6_representatives_with_traffic_30d: kpi6,
    kpi7_whatsapp_clicks: kpi7,
    kpi8_leads: kpi8,
    kpi9_representative_with_result: kpi9,
    kpi10_paid_customer: kpi10,
    kpi11_paid_conversion_rate: kpi11,
    kpi11b_founding_cohort_conversion: kpi11b,
    mrr_reais: mrr,
    kpi12_cancellations: kpi12,
    kpi13_retention: kpi13,
    kpi14_feedback_distribution: kpi14,
    kpi15_cancellation_reasons: cancellationReasons,
  };
}

function parseArgs(argv: readonly string[]) {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    const [, key, value] = match ?? [];
    if (key !== undefined && value !== undefined) flags.set(key, value);
  }
  const format = flags.get('format') ?? 'both';
  if (!['json', 'markdown', 'both'].includes(format)) {
    console.error(`--format inválido: ${format} (use json|markdown|both)`);
    process.exit(1);
  }
  const environment = flags.get('environment');
  if (environment !== undefined && !['production', 'development'].includes(environment)) {
    console.error(`--environment inválido: ${environment} (use production|development)`);
    process.exit(1);
  }
  return {
    format: format as 'json' | 'markdown' | 'both',
    outDir: flags.get('out-dir') ?? 'docs/metrics/snapshots',
    // Opcional: uma afirmação explícita de qual ambiente o chamador ESPERA
    // estar coletando. Quando presente, precisa bater com o que a própria
    // NEXT_PUBLIC_SUPABASE_URL resolve — ver `resolveEnvironmentBinding()`.
    // Sem isso, alguém poderia rodar `--environment=production` contra
    // `smspbjmqhpjcjilzoexr` (dev/test) e produzir um snapshot rotulado
    // "produção" que na verdade não é — exatamente o "snapshot
    // semanticamente falso" apontado nesta revisão.
    declaredEnvironment: (environment as 'production' | 'development' | undefined) ?? null,
  };
}

function gitShaOf(pathspec: string): string | null {
  try {
    return execSync(`git log -1 --format=%H -- ${pathspec}`, { cwd: process.cwd() }).toString().trim() || null;
  } catch {
    return null;
  }
}

function gitHeadSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: process.cwd() }).toString().trim();
  } catch {
    return null;
  }
}

/**
 * `true`/`false` quando `git status --porcelain` roda com sucesso;
 * `null` quando não é possível determinar (ex.: `.git` ausente no
 * ambiente de execução) — nunca finge saber o que não sabe.
 */
function gitIsDirty(): boolean | null {
  try {
    const out = execSync('git status --porcelain', { cwd: process.cwd() }).toString();
    return out.trim().length > 0;
  } catch {
    return null;
  }
}

/**
 * SHA-256 hexadecimal do conteúdo passado — usado para
 * `collector_content_sha256`/`spec_content_sha256` (provenance por
 * conteúdo, não só por commit — ver o cabeçalho deste arquivo). Pura,
 * testável com bytes fixos, sem depender de filesystem/git.
 */
export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

const SUPABASE_HOSTED_HOST_PATTERN = /^([a-z0-9]{20})\.supabase\.co$/;

export interface EnvironmentBindingInput {
  readonly supabaseUrl?: string | null;
  /** Do `--environment` opcional — `null` quando o chamador não declarou nenhum. */
  readonly declaredEnvironment?: 'production' | 'development' | null;
}
export interface EnvironmentBindingResult {
  readonly verdict: 'ALLOW' | 'BLOCK';
  readonly reason: string;
  readonly projectRef: string | null;
  readonly environment: 'production' | 'development' | 'unknown';
}

/**
 * Vincula `NEXT_PUBLIC_SUPABASE_URL` a um `environment` real, com
 * project ref explícito — nunca um rótulo solto. Deliberadamente NÃO
 * reaproveita `assertSupabaseIntegrationTargetIsSafe()`
 * (`scripts/supabase-production-guard.mjs`): aquele guard existe para
 * BLOQUEAR testes/fixtures contra produção; este coletor precisa
 * legitimamente LER produção — reutilizar o guard de teste cegamente
 * quebraria esse caso de uso real. Reaproveita só as duas constantes de
 * project ref já testadas daquele módulo (dado puro, não a semântica de
 * bloqueio).
 *
 * Fail-closed em três casos, todos formalmente exigidos por esta revisão:
 * URL ausente/inválida, project ref fora do mapa canônico conhecido
 * (nunca assume "desconhecido = seguro"), e uma declaração explícita
 * (`--environment=`) que não bate com o ambiente real resolvido da URL.
 */
export function resolveEnvironmentBinding(input: EnvironmentBindingInput): EnvironmentBindingResult {
  const { supabaseUrl, declaredEnvironment } = input;

  if (!supabaseUrl) {
    return { verdict: 'BLOCK', reason: 'NEXT_PUBLIC_SUPABASE_URL ausente.', projectRef: null, environment: 'unknown' };
  }

  let hostname: string;
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    return {
      verdict: 'BLOCK',
      reason: `NEXT_PUBLIC_SUPABASE_URL não é uma URL válida: ${JSON.stringify(supabaseUrl)}.`,
      projectRef: null,
      environment: 'unknown',
    };
  }

  const match = SUPABASE_HOSTED_HOST_PATTERN.exec(hostname);
  if (!match) {
    return {
      verdict: 'BLOCK',
      reason: `host não é um projeto Supabase reconhecível: "${hostname}".`,
      projectRef: null,
      environment: 'unknown',
    };
  }

  const projectRef = match[1]!;
  const environment: 'production' | 'development' | 'unknown' =
    projectRef === PRODUCTION_SUPABASE_PROJECT_REF
      ? 'production'
      : ALLOWED_TEST_SUPABASE_PROJECT_REFS.includes(projectRef)
        ? 'development'
        : 'unknown';

  if (environment === 'unknown') {
    return {
      verdict: 'BLOCK',
      reason: `project ref "${projectRef}" não está no mapa canônico de ambientes conhecidos (production=${PRODUCTION_SUPABASE_PROJECT_REF}, development=${ALLOWED_TEST_SUPABASE_PROJECT_REFS.join(',')}) — falha fechada, nenhum modo "desconhecido, mas permitido" existe hoje.`,
      projectRef,
      environment,
    };
  }

  if (declaredEnvironment && declaredEnvironment !== environment) {
    return {
      verdict: 'BLOCK',
      reason: `--environment=${declaredEnvironment} não bate com o ambiente real resolvido de NEXT_PUBLIC_SUPABASE_URL (${environment}, project ref ${projectRef}).`,
      projectRef,
      environment,
    };
  }

  return {
    verdict: 'ALLOW',
    reason: `project ref ${projectRef} resolvido para "${environment}".`,
    projectRef,
    environment,
  };
}

function toMarkdown(output: Record<string, unknown>): string {
  return [
    `# Stage 1 KPI snapshot — ${output.collected_at}`,
    '',
    `- **environment:** ${output.environment} (project ref \`${output.supabase_project_ref}\`)`,
    `- **spec_content_sha256:** \`${output.spec_content_sha256}\` (${output.spec_document})`,
    `- **collector_content_sha256:** \`${output.collector_content_sha256}\` (${output.collector_script})`,
    `- **git_sha:** \`${output.git_sha}\`${output.git_dirty ? ' (⚠ working tree tinha alterações não commitadas)' : ''}`,
    `- **timezone:** ${output.timezone}`,
    '',
    '## Metrics',
    '',
    '```json',
    JSON.stringify(output.metrics, null, 2),
    '```',
    '',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
    process.exit(1);
  }

  // Vínculo ambiente↔project-ref, fail-closed, ANTES de qualquer chamada de
  // rede — ver `resolveEnvironmentBinding()` acima para por que isto não é
  // apenas um rótulo e por que não reaproveita o guard de teste.
  const binding = resolveEnvironmentBinding({ supabaseUrl, declaredEnvironment: args.declaredEnvironment });
  if (binding.verdict === 'BLOCK') {
    console.error(`\n🛑 FATAL: ${binding.reason}\n\n   Nenhuma leitura foi executada.\n`);
    process.exit(1);
  }

  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  async function get<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${supabaseUrl}${path}`, { method: 'GET', headers });
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  const collectedAt = new Date().toISOString(); // sempre UTC ('Z')
  const specPath = resolve(process.cwd(), 'docs/plans/STAGE_1_KPI_SPECIFICATION.md');
  const specVersion = gitShaOf('docs/plans/STAGE_1_KPI_SPECIFICATION.md');
  const specContentSha256 = (() => {
    try {
      return sha256Hex(readFileSync(specPath));
    } catch {
      return null;
    }
  })();
  const collectorPath = fileURLToPath(import.meta.url);
  const collectorContentSha256 = sha256Hex(readFileSync(collectorPath));
  const collectorGitSha = gitHeadSha();
  const gitDirty = gitIsDirty();

  const [lifecycleEvents, activations, analyticsEvents, leads, subscriptions, feedback, representatives] = await Promise.all([
    get<LifecycleEventRow[]>('/rest/v1/representative_lifecycle_events?select=representative_id,event_type,occurred_at'),
    get<ActivationRow[]>('/rest/v1/product_activations?select=representative_id,product_id,status,published_at'),
    get<AnalyticsRow[]>('/rest/v1/analytics_events?select=representative_id,event_type,created_at'),
    get<LeadRow[]>('/rest/v1/leads?select=representative_id,created_at'),
    get<SubscriptionRow[]>('/rest/v1/subscriptions?select=representative_id,status,provider,amount_cents,updated_at'),
    get<FeedbackRow[]>('/rest/v1/feedback_responses?select=context,response,answered_at'),
    get<{ id: string }[]>('/rest/v1/representatives?select=id'),
  ]);

  const metrics = computeStage1Metrics({
    lifecycleEvents,
    activations,
    analyticsEvents,
    leads,
    subscriptions,
    feedback,
    representativesCount: representatives.length,
    now: Date.now(),
  });

  const output = {
    collected_at: collectedAt,
    timezone: 'UTC',
    // Provenance por CONTEÚDO — a fonte de verdade de reprodutibilidade.
    // `git_sha`/`git_dirty` continuam presentes como metadado adicional
    // (úteis para achar o commit num histórico limpo), mas nunca são a
    // única forma de identificar o que rodou de fato: com o working tree
    // sujo, git_sha sozinho mentiria sobre qual código realmente executou.
    spec_document: 'docs/plans/STAGE_1_KPI_SPECIFICATION.md',
    spec_content_sha256: specContentSha256,
    collector_script: 'scripts/collect-stage-1-kpis.ts',
    collector_content_sha256: collectorContentSha256,
    git_sha: collectorGitSha,
    git_dirty: gitDirty,
    // Mantido por compatibilidade com snapshots anteriores a esta revisão
    // — `spec_content_sha256`/`collector_content_sha256` são agora a fonte
    // de verdade; `spec_version`/`collector_version` (SHA do commit que
    // por último tocou cada arquivo) continuam úteis para navegar o
    // histórico do Git, não para provar o que rodou.
    spec_version: specVersion,
    collector_version: collectorGitSha,
    environment: binding.environment,
    supabase_project_ref: binding.projectRef,
    metrics,
  };

  const outDir = resolve(process.cwd(), args.outDir);
  mkdirSync(outDir, { recursive: true });
  const stamp = collectedAt.replace(/[:.]/g, '-');

  if (args.format === 'json' || args.format === 'both') {
    const jsonPath = resolve(outDir, `${stamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(output, null, 2) + '\n');
    console.log(`JSON: ${jsonPath}`);
  }
  if (args.format === 'markdown' || args.format === 'both') {
    const mdPath = resolve(outDir, `${stamp}.md`);
    writeFileSync(mdPath, toMarkdown(output));
    console.log(`Markdown: ${mdPath}`);
  }
  console.log(JSON.stringify(output, null, 2));
}

// `require.main === module`-equivalente em ESM: só roda main() quando este
// arquivo é o entrypoint (`tsx scripts/collect-stage-1-kpis.ts`), nunca
// quando é importado por um teste (`computeStage1Metrics`/outros exports).
// `pathToFileURL` (não uma concatenação manual de `file://`) é o que torna
// isto correto no Windows — confirmado ao vivo: a comparação de string cru
// falha ali por causa de barra/drive-letter, deixando `main()` nunca
// rodar e o script sair em silêncio, sem erro nenhum.
if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main().catch((error: unknown) => {
    console.error('Erro inesperado na coleta de KPIs:', error);
    process.exit(1);
  });
}
