import type { StartCheckoutResult } from '@/modules/billing/application/start-checkout';

interface CheckoutErrorCopy {
  readonly title: string;
  readonly description?: string;
}

export type StartCheckoutFailure = Exclude<StartCheckoutResult, { status: 'redirect' }>;

const GENERIC_ERROR_COPY: CheckoutErrorCopy = {
  title: 'Não foi possível concluir agora',
  description: 'Tente novamente em alguns instantes, ou cheque se as informações estão corretas.',
};

const REJECTION_MESSAGES: Record<Extract<StartCheckoutResult, { status: 'rejected' }>['reason'], CheckoutErrorCopy> = {
  invalid_document: { title: 'CPF ou CNPJ inválido', description: 'Confira o documento informado e tente novamente.' },
  duplicate_customer: GENERIC_ERROR_COPY,
  invalid_customer: GENERIC_ERROR_COPY,
};

export function checkoutErrorCopy(failure: StartCheckoutFailure): CheckoutErrorCopy {
  switch (failure.status) {
    case 'already_active':
      return { title: 'Sua assinatura já está ativa' };
    case 'sold_out':
      return {
        title: 'As vagas do preço de lançamento se esgotaram',
        description: 'Fale com o suporte para saber as condições atuais.',
      };
    case 'rejected':
      return REJECTION_MESSAGES[failure.reason];
    default:
      return GENERIC_ERROR_COPY;
  }
}
