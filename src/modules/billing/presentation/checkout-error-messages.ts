import type { StartCheckoutResult } from '@/modules/billing/application/start-checkout';

interface CheckoutErrorCopy {
  readonly title: string;
  readonly description?: string;
}

export type StartCheckoutFailure = Exclude<StartCheckoutResult, { status: 'pending' }>;

const GENERIC_ERROR_COPY: CheckoutErrorCopy = {
  title: 'Não foi possível concluir agora',
  description: 'Atualize a página e tente novamente.',
};

const REJECTION_MESSAGES: Record<Extract<StartCheckoutResult, { status: 'rejected' }>['reason'], CheckoutErrorCopy> = {
  invalid_document: { title: 'CPF ou CNPJ inválido', description: 'Confira o documento informado e tente novamente.' },
  duplicate_customer: GENERIC_ERROR_COPY,
  card_declined: { title: 'Cartão recusado', description: 'Confira os dados do cartão ou tente outro cartão.' },
  invalid_card: { title: 'Dados do cartão inválidos', description: 'Confira o número, validade e código de segurança.' },
  invalid_holder_data: { title: 'Dados do titular inválidos', description: 'Confira nome, CEP e número do endereço.' },
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
