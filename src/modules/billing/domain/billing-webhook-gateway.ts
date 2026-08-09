/**
 * Port de escrita para o webhook do Asaas (SET-29/30) — fronteira de
 * confiança diferente de `SubscriptionGateway`: aquele é acionado por uma
 * Server Action com sessão de usuário; este é acionado por uma requisição
 * externa autenticada por token estático, sem sessão nenhuma. Separado em
 * vez de estender `SubscriptionGateway` para não misturar as duas
 * fronteiras no mesmo port.
 *
 * `applyEvent` espelha `apply_billing_event()`
 * (`supabase/migrations/20260827000000_add_billing_webhook_events.sql`):
 * deduplica por `eventId`, casa a linha por `asaasSubscriptionId` (todo
 * evento após o primeiro pagamento) ou `externalReference` (só o primeiro
 * `CHECKOUT_PAID`, antes de existir um `external_subscription_id` local), e
 * aplica a transição de estado — tudo na mesma transação da própria
 * migration, já que este projeto não tem infraestrutura de job/fila
 * (`docs/plans/SPRINT_E_PLAN.md` §2.4) para separar "persistir" de
 * "processar".
 */
export interface ApplyBillingEventInput {
  readonly eventId: string;
  readonly eventType: string;
  readonly asaasSubscriptionId: string | null;
  readonly asaasCustomerId: string | null;
  readonly externalReference: string | null;
  /** Data (ISO `YYYY-MM-DD`) da próxima cobrança, quando o evento a informa. */
  readonly nextDueDate: string | null;
  /** Payload cru do evento, gravado em `billing_events.payload` para auditoria. */
  readonly payload: unknown;
}

export type ApplyBillingEventResult =
  | { readonly status: 'applied'; readonly subscriptionId: string }
  | { readonly status: 'duplicate' }
  | { readonly status: 'ignored' }
  | { readonly status: 'unmatched' }
  | { readonly status: 'error' };

export interface BillingWebhookGateway {
  applyEvent(input: ApplyBillingEventInput): Promise<ApplyBillingEventResult>;
}
