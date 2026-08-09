import type { CancelOwnSubscriptionResult } from '@/modules/billing/application/cancel-subscription';

interface CancelSubscriptionErrorCopy {
  readonly title: string;
  readonly description?: string;
}

export type CancelSubscriptionFailure = Exclude<
  CancelOwnSubscriptionResult,
  { status: 'canceled' } | { status: 'already_canceled' }
>;

const COPY: Record<CancelSubscriptionFailure['status'], CancelSubscriptionErrorCopy> = {
  not_found: {
    title: 'Nenhuma assinatura para cancelar',
    description: 'Atualize a página — talvez sua assinatura já tenha sido cancelada.',
  },
  error: {
    title: 'Não foi possível cancelar agora',
    description: 'Tente novamente em instantes ou fale com o suporte.',
  },
};

export function cancelSubscriptionErrorCopy(failure: CancelSubscriptionFailure): CancelSubscriptionErrorCopy {
  return COPY[failure.status];
}
