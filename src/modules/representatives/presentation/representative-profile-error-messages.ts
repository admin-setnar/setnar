import type {
  UpdateRepresentativeProfileRejectionReason,
  UpdateRepresentativeProfileResult,
} from '@/modules/representatives/domain/representative-profile-gateway';

interface ProfileErrorCopy {
  readonly title: string;
  readonly description?: string;
}

/**
 * The non-`'updated'` outcomes `updateRepresentativeProfileAction` can
 * return — `Exclude`, not a hand-written union, same reasoning
 * `RegisterRepresentativeFailure` already documents.
 */
export type UpdateRepresentativeProfileFailure = Exclude<UpdateRepresentativeProfileResult, { status: 'updated' }>;

const GENERIC_ERROR_COPY: ProfileErrorCopy = {
  title: 'Não foi possível salvar agora',
  description: 'Tente novamente em instantes.',
};

/**
 * `representative_not_found` is generic/operational on purpose, same
 * reasoning `company_not_found` already uses in
 * `representative-onboarding-error-messages.ts`: it means the signed-in User
 * has no Representative row, which cannot happen from this form (only
 * rendered inside the hub, which only renders once a Representative exists)
 * — an unreachable-through-normal-use case, not something the user caused or
 * can fix by rewording an answer.
 */
const REJECTION_MESSAGES: Record<UpdateRepresentativeProfileRejectionReason, ProfileErrorCopy> = {
  representative_not_found: GENERIC_ERROR_COPY,
  authorization_id_invalid: {
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

export function representativeProfileErrorCopy(failure: UpdateRepresentativeProfileFailure): ProfileErrorCopy {
  if (failure.status === 'error') return GENERIC_ERROR_COPY;
  return REJECTION_MESSAGES[failure.reason];
}
