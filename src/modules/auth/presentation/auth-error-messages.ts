import type { AuthErrorCode } from '@/modules/auth/domain/auth';

interface AuthErrorCopy {
  readonly title: string;
  readonly description?: string;
}

/**
 * Translates domain failure codes into wording the user can act on.
 *
 * Errors explain what happened and what to do next. They never apologise and
 * never expose provider or network detail.
 */
const MESSAGES: Record<AuthErrorCode, AuthErrorCopy> = {
  invalid_credentials: {
    title: 'E-mail ou senha não conferem',
    description: 'Confira os dados e tente novamente.',
  },
  email_already_registered: {
    title: 'Este e-mail já tem conta no Setnar',
    description: 'Entre com a sua senha ou use a opção de recuperação.',
  },
  weak_password: {
    title: 'Escolha uma senha mais forte',
    description: 'Use ao menos 8 caracteres, combinando letras e números.',
  },
  rate_limited: {
    title: 'Muitas tentativas seguidas',
    description: 'Aguarde alguns minutos antes de tentar de novo.',
  },
  provider_unavailable: {
    title: 'Entrada por provedor externo ainda não disponível',
    description: 'Use seu e-mail e senha para continuar.',
  },
  unknown: {
    title: 'Não foi possível concluir agora',
    description: 'Tente novamente em instantes.',
  },
};

export function authErrorCopy(code: AuthErrorCode): AuthErrorCopy {
  return MESSAGES[code];
}
