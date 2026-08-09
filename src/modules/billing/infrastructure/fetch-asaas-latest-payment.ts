import type { GetLatestPaymentResult, ReconcilablePaymentStatus } from '@/modules/billing/domain/payment-gateway';

const RECONCILABLE_PAYMENT_STATUSES: ReadonlySet<string> = new Set(['CONFIRMED', 'RECEIVED', 'OVERDUE']);

/**
 * `docs.asaas.com/reference/list-payments` lista muitos outros valores
 * (`PENDING`, `REFUNDED`, disputas de chargeback, etc.) — nenhum tem
 * transição de entitlement definida (SET-25), então viram `'OTHER'`: a
 * reconciliação (SET-33) relata e não escreve nada para eles, mesmo
 * comportamento de "ignored" que `apply_billing_event()` já tem para tipos
 * de evento fora do lifecycle do MVP.
 */
export function mapAsaasPaymentStatus(status: string | undefined): ReconcilablePaymentStatus | 'OTHER' {
  if (status && RECONCILABLE_PAYMENT_STATUSES.has(status)) {
    return status as ReconcilablePaymentStatus;
  }
  return 'OTHER';
}

/**
 * Deliberadamente SEM `import 'server-only'` — diferente de
 * `asaas-payment-gateway.ts` (o adapter real, chamado pela aplicação
 * Next.js, esse sim server-only). Esta função é consumida por dois
 * chamadores: o adapter (via `getLatestPayment()`) e
 * `scripts/reconcile-billing-subscription.ts`, um script standalone que
 * roda fora do bundle da aplicação — `server-only` lança
 * incondicionalmente fora do build do Next (não é gated por `window`,
 * confirmado lendo `node_modules/server-only/index.js`), então qualquer
 * módulo que o importe é inelegível para um script Node puro. Mesmo padrão
 * de `map-asaas-error.ts`/`map-subscription-gateway-result.ts`: mapeadores/
 * chamadas puras HTTP ficam fora da fronteira `server-only`, só o adapter
 * com a factory que lê `process.env` fica marcado.
 *
 * SET-33 — o pagamento mais recente de uma assinatura, para reconciliar um
 * webhook que nunca chegou. `limit=10` e ordenação client-side por
 * `dueDate` (não confiamos na ordem devolvida pela API, que não é
 * documentada como garantida) — dez é generoso para "o mais recente" sem
 * paginar; uma assinatura mensal nunca acumula mais que isso entre
 * reconciliações plausíveis.
 */
export async function fetchAsaasLatestPayment(
  config: { readonly apiKey: string; readonly baseUrl: string },
  externalSubscriptionId: string,
): Promise<GetLatestPaymentResult> {
  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl}/v3/payments?subscription=${encodeURIComponent(externalSubscriptionId)}&limit=10`,
      { headers: { access_token: config.apiKey } },
    );
  } catch {
    return { status: 'error' };
  }

  if (!response.ok) return { status: 'error' };

  const body = (await response.json().catch(() => null)) as {
    data?: ReadonlyArray<{ id?: string; status?: string; customer?: string; dueDate?: string }>;
  } | null;
  const payments = body?.data ?? [];
  if (payments.length === 0) return { status: 'not_found' };

  const latest = [...payments].sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? ''))[0];
  if (!latest?.id) return { status: 'error' };

  return {
    status: 'found',
    paymentId: latest.id,
    paymentStatus: mapAsaasPaymentStatus(latest.status),
    customerId: latest.customer ?? null,
    dueDate: latest.dueDate ?? null,
  };
}
