/**
 * `'canceled'`/`'past_due'` são valores legais desde a migration original
 * (`20260731000000`), mas `'past_due'` fica reservado e sem uso real: a
 * política aprovada (SET-25) mantém `active` durante toda a janela de retry
 * do próprio gateway e só escreve `suspended` quando ela esgota — ver
 * `docs/plans/BILLING_DECISIONS_PLAN.md` §5.
 */
export type SubscriptionStatus = 'active' | 'past_due' | 'suspended' | 'canceled';

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
