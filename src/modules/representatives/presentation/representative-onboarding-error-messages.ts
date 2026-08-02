import type {
  RegisterRepresentativeRejectionReason,
  RegisterRepresentativeResult,
} from '@/modules/representatives/domain/representative-onboarding-gateway';

interface OnboardingErrorCopy {
  readonly title: string;
  readonly description?: string;
}

/**
 * Every non-`'created'` outcome of `registerRepresentativeAction` — the
 * shape the form actually has in hand once it has already checked
 * `result.status !== 'created'`. `Exclude` here, not a hand-written union: it
 * stays in sync with `RegisterRepresentativeResult` automatically if a
 * variant is ever added there, instead of risking a second, driftable copy
 * of that shape.
 */
export type RegisterRepresentativeFailure = Exclude<RegisterRepresentativeResult, { status: 'created' }>;

/**
 * Translates the 8 typed rejection reasons into wording the user can act on.
 * Same copy rule as `auth-error-messages.ts`: state what happened and how to
 * recover, never expose technical detail, never apologise.
 *
 * `company_not_found` is deliberately generic, not "something's wrong with
 * our catalog" or similar: it means the D1 seed is missing in this
 * environment (see `20260806000000`'s header) — an operational failure the
 * user did not cause and cannot fix, so it gets the same wording as
 * `'error'` below rather than a description that would only confuse them.
 */
const REJECTION_MESSAGES: Record<RegisterRepresentativeRejectionReason, OnboardingErrorCopy> = {
  slug_invalid: {
    title: 'Esse endereço não pode ser usado',
    description: 'Escolha outro formato.',
  },
  slug_taken: {
    title: 'Esse endereço já está em uso',
    description: 'Escolha outro.',
  },
  already_registered: {
    title: 'Você já tem uma página cadastrada',
  },
  company_not_found: {
    title: 'Não foi possível concluir agora',
    description: 'Tente novamente em instantes.',
  },
  display_name_invalid: {
    title: 'Informe seu nome e sobrenome',
    description: 'Use até 80 caracteres.',
  },
  license_id_invalid: {
    title: 'Número de identificação inválido',
    description: 'Confira o número informado.',
  },
  phone_invalid: {
    title: 'Telefone inválido',
    description: 'Digite um telefone válido, como (11) 98888-7777.',
  },
  city_invalid: {
    title: 'Cidade inválida',
    description: 'Use um texto mais curto.',
  },
};

const GENERIC_ERROR_COPY: OnboardingErrorCopy = {
  title: 'Não foi possível concluir agora',
  description: 'Tente novamente em instantes.',
};

export function onboardingErrorCopy(failure: RegisterRepresentativeFailure): OnboardingErrorCopy {
  if (failure.status === 'error') {
    return GENERIC_ERROR_COPY;
  }
  return REJECTION_MESSAGES[failure.reason];
}
