import type {
  ActivateProductRejectionReason,
  ActivateProductResult,
  SetActivationStatusRejectionReason,
  SetActivationStatusResult,
} from '@/modules/representatives/domain/product-activation-gateway';

interface ActivationErrorCopy {
  readonly title: string;
  readonly description?: string;
}

/**
 * The non-`'activated'` outcomes `activateProductAction` can return —
 * `Exclude`, not a hand-written union, same reasoning
 * `RegisterRepresentativeFailure` already documents.
 */
export type ActivateProductFailure = Exclude<ActivateProductResult, { status: 'activated' }>;

/** The non-`'updated'` outcomes `setActivationStatusAction` can return. */
export type SetActivationStatusFailure = Exclude<SetActivationStatusResult, { status: 'updated' }>;

const GENERIC_ERROR_COPY: ActivationErrorCopy = {
  title: 'Não foi possível concluir agora',
  description: 'Atualize a página e tente novamente.',
};

/**
 * Every reason here except `phone_required`/`representative_not_active` is
 * unreachable through the hub's own UI in normal use (the hub only ever
 * offers "activate" for a Product already known to be in the Company's own
 * Catalog, and only offers "publish" for a Product already known to be
 * activated) — they exist for a direct RPC caller or a stale page, not a
 * click path this UI produces. Copy stays honest and actionable regardless:
 * "atualize a página" for the ones a stale render could cause,
 * `representative_not_active` and `phone_required` get real, specific
 * guidance because both ARE reachable from normal use (an operator
 * suspending the account; a Representative who never filled in their phone
 * in D5b).
 */
const ACTIVATE_REJECTION_MESSAGES: Record<ActivateProductRejectionReason, ActivationErrorCopy> = {
  representative_not_found: GENERIC_ERROR_COPY,
  product_not_found: GENERIC_ERROR_COPY,
  product_not_in_catalog: GENERIC_ERROR_COPY,
};

const SET_STATUS_REJECTION_MESSAGES: Record<SetActivationStatusRejectionReason, ActivationErrorCopy> = {
  representative_not_found: GENERIC_ERROR_COPY,
  not_activated: GENERIC_ERROR_COPY,
  invalid_status: GENERIC_ERROR_COPY,
  invalid_transition: GENERIC_ERROR_COPY,
  representative_not_active: {
    title: 'Sua conta está suspensa',
    description: 'Fale com o suporte para reativar antes de publicar.',
  },
  display_name_required: {
    title: 'Complete seu nome antes de publicar',
    description: 'Edite seu perfil e informe nome e sobrenome.',
  },
  phone_required: {
    title: 'Informe um telefone antes de publicar',
    description: 'Edite seu perfil e adicione um telefone de contato.',
  },
};

export function activateErrorCopy(failure: ActivateProductFailure): ActivationErrorCopy {
  if (failure.status === 'error') return GENERIC_ERROR_COPY;
  return ACTIVATE_REJECTION_MESSAGES[failure.reason];
}

export function setActivationStatusErrorCopy(failure: SetActivationStatusFailure): ActivationErrorCopy {
  if (failure.status === 'error') return GENERIC_ERROR_COPY;
  return SET_STATUS_REJECTION_MESSAGES[failure.reason];
}
