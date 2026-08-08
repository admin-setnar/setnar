import type { SubscriptionStatus } from '@/modules/billing/domain/subscription';

/**
 * Espelha `get_own_subscription_view()` linha por linha — `null` (o
 * repositório inteiro devolvendo `null`, não um objeto com campos nulos)
 * significa "nunca iniciou checkout", mesma semântica de ausência de linha
 * já estabelecida em `SPRINT_E_PLAN.md` §3.1 Opção B.
 */
export interface OwnSubscriptionView {
  readonly status: SubscriptionStatus;
  readonly amountCents: number | null;
  readonly currency: string;
  readonly currentPeriodEnd: string | null;
  readonly hasExternalSubscription: boolean;
}

/**
 * Port de leitura da própria Subscription (SET-28/31) — "Repository" por
 * convenção deste módulo (só-leitura); `SubscriptionGateway` é o port de
 * escrita.
 */
export interface SubscriptionRepository {
  getOwnSubscription(): Promise<OwnSubscriptionView | null>;
}
