/**
 * `'canceled'`/`'past_due'` são valores legais desde a migration original
 * (`20260731000000`), mas `'past_due'` fica reservado e sem uso real: a
 * política aprovada (SET-25) mantém `active` durante toda a janela de retry
 * do próprio gateway e só escreve `suspended` quando ela esgota — ver
 * `docs/plans/BILLING_DECISIONS_PLAN.md` §5.
 *
 * `'trialing'` (SET-67) nasce em `register_representative()`, na conclusão
 * do onboarding — nunca reaproveita `past_due`/`suspended`. `current_period_end`
 * guarda o fim do trial, mesma coluna já usada para a graça pós-cancelamento;
 * `is_subscription_active()` reavalia essa data ao vivo em toda leitura, sem
 * job. A linha permanece `trialing` para sempre após a expiração — o mesmo
 * padrão já usado para `canceled` (DOMAIN_MODEL.md §14.3) — até uma
 * conversão real escrever `active`.
 */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'suspended' | 'canceled';

/**
 * Único valor legal hoje é `'credit_card'` (SET-24). Ampliar para Pix
 * Automático é uma nova migration alterando a CHECK de
 * `subscriptions.payment_method`, nunca uma coluna nova — decisão registrada
 * em `docs/plans/BILLING_DECISIONS_PLAN.md` §6.1.
 */
export type PaymentMethod = 'credit_card';

/**
 * O Value Object "Money" que `docs/DOMAIN_MODEL.md` §9 já reserva como
 * placeholder para Billing. `currency` é um union de um valor só de
 * propósito — mesmo raciocínio de `PaymentMethod`: ampliar é aditivo.
 */
export interface Money {
  readonly amountCents: number;
  readonly currency: 'BRL';
}
