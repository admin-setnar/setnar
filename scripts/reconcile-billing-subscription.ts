/**
 * SET-33 — reconciliação manual de uma Subscription contra o Asaas.
 *
 * Existe para o único cenário que um webhook idempotente (SET-29/30) não
 * resolve sozinho: o evento nunca chegou (entrega falhou nas 15 tentativas
 * do Asaas, fila pausada, etc. — ver ADR-075). Este script pergunta ao
 * Asaas qual é o pagamento mais recente de verdade e alimenta o mesmo
 * `apply_billing_event()` que o webhook usa, com o `id` real do pagamento
 * como `asaas_event_id` — se o webhook atrasado chegar depois, a dedup de
 * sempre (unique constraint) o ignora sozinha. Nenhuma lógica de aplicação
 * de estado nova, nenhuma tabela de fila: reconciliar é só uma fonte
 * alternativa para o mesmo pipe.
 *
 * "Protegido" (Linear SET-33, "comando/script protegido"): não há sistema
 * de roles/admin neste projeto (`docs/plans/SPRINT_E_PLAN.md` §2.4) — a
 * posse de `SUPABASE_SERVICE_ROLE_KEY`+`ASAAS_API_KEY`, nunca expostas à
 * aplicação, é a própria autorização. `--reason`/`--actor` são exigidos
 * antes de qualquer escrita — nunca opcionais, mesmo em uso interativo.
 *
 * Uso:
 *   npm run reconcile:billing -- --representative-id=<uuid> --reason="..." --actor="Pedro"
 *
 * Roda em modo leitura por padrão (só consulta o Asaas e imprime o que
 * faria); passar `--apply` para escrever de verdade (`apply_billing_event`
 * + a linha de auditoria). Sem `--apply`, nada é gravado — nem em
 * `billing_reconciliation_log`, nem em `subscriptions`.
 */
import { createClient } from '@supabase/supabase-js';

import { resolveReconciliationPlan } from '@/modules/billing/application/reconcile-subscription';
import { fetchAsaasLatestPayment } from '@/modules/billing/infrastructure/fetch-asaas-latest-payment';

interface CliArgs {
  readonly representativeId: string;
  readonly reason: string;
  readonly actor: string;
  readonly apply: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const flags = new Map<string, string>();
  let apply = false;
  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    const [, key, value] = match ?? [];
    if (key !== undefined && value !== undefined) flags.set(key, value);
  }

  const representativeId = flags.get('representative-id');
  const reason = flags.get('reason');
  const actor = flags.get('actor');

  if (!representativeId || !reason || !actor) {
    console.error(
      'Uso: npm run reconcile:billing -- --representative-id=<uuid> --reason="..." --actor="..." [--apply]\n' +
        '--representative-id, --reason e --actor são obrigatórios. Sem --apply, roda em modo leitura (nada é gravado).',
    );
    process.exit(1);
  }

  return { representativeId, reason, actor, apply };
}

async function main() {
  const { representativeId, reason, actor, apply } = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const asaasApiKey = process.env.ASAAS_API_KEY;
  const asaasBaseUrl = process.env.ASAAS_BASE_URL;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
    process.exit(1);
  }
  if (!asaasApiKey || !asaasBaseUrl) {
    console.error('ASAAS_API_KEY e ASAAS_BASE_URL são obrigatórias.');
    process.exit(1);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const asaasConfig = { apiKey: asaasApiKey, baseUrl: asaasBaseUrl };

  async function logOutcome(outcome: string, detail: Record<string, unknown>) {
    if (!apply) {
      console.log(`[dry-run, nada gravado] outcome=${outcome}`, detail);
      return;
    }
    const { error } = await service.from('billing_reconciliation_log').insert({
      actor,
      reason,
      representative_id: representativeId,
      subscription_id: detail.subscriptionId ?? null,
      gateway_payment_id: detail.paymentId ?? null,
      gateway_payment_status: detail.paymentStatus ?? null,
      outcome,
      detail,
    });
    if (error) {
      console.error('Falha ao gravar a trilha de auditoria (billing_reconciliation_log):', error.message);
    }
    console.log(`outcome=${outcome}`, detail);
  }

  const { data: subscription, error: subscriptionError } = await service
    .from('subscriptions')
    .select('id, status, external_subscription_id, external_customer_id')
    .eq('representative_id', representativeId)
    .maybeSingle();

  if (subscriptionError) {
    console.error('Falha ao ler a Subscription:', subscriptionError.message);
    process.exit(1);
  }

  if (!subscription || !subscription.external_subscription_id) {
    await logOutcome('no_subscription', {
      subscriptionId: subscription?.id ?? null,
      reasonDetail: subscription ? 'sem external_subscription_id (nunca automatizada)' : 'representante sem Subscription',
    });
    return;
  }

  const latestPayment = await fetchAsaasLatestPayment(asaasConfig, subscription.external_subscription_id);

  const plan = resolveReconciliationPlan(
    {
      id: subscription.id,
      externalSubscriptionId: subscription.external_subscription_id,
      externalCustomerId: subscription.external_customer_id,
    },
    latestPayment,
    apply,
  );

  if (plan.action === 'log') {
    await logOutcome(plan.outcome, { ...plan.detail });
    return;
  }

  const { data: applied, error: applyError } = await service.rpc('apply_billing_event', {
    p_event_id: plan.event.eventId,
    p_event_type: plan.event.eventType,
    p_asaas_subscription_id: plan.event.asaasSubscriptionId,
    p_asaas_customer_id: plan.event.asaasCustomerId,
    p_external_reference: null,
    p_next_due_date: plan.event.nextDueDate,
    p_payload: { source: 'reconciliation', actor, reason },
  });

  if (applyError) {
    console.error('Falha ao aplicar o evento reconciliado:', applyError.message);
    await logOutcome('gateway_error', { subscriptionId: plan.detail.subscriptionId, applyRpcError: applyError.message });
    process.exit(1);
  }

  const outcome = applied?.[0]?.outcome ?? 'gateway_error';
  await logOutcome(outcome, { ...plan.detail });
}

main().catch((error: unknown) => {
  console.error('Erro inesperado na reconciliação:', error);
  process.exit(1);
});
