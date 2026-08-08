/**
 * Forma mínima de uma resposta de erro do Asaas
 * (`{"errors":[{"code":"...","description":"..."}]}`, documentada em
 * docs.asaas.com). Tipo estrutural próprio, não importado de um SDK — este
 * projeto não depende do SDK do Asaas, só chama a REST API via `fetch`
 * (ver `asaas-payment-gateway.ts`) — mesmo raciocínio de
 * `SupabaseAuthErrorLike` em `modules/auth/infrastructure/map-supabase-auth-error.ts`:
 * fica testável com um objeto plano, sem cliente real.
 */
export interface AsaasErrorResponseLike {
  readonly errors?: ReadonlyArray<{ readonly code?: string; readonly description?: string }>;
}

export type AsaasCustomerErrorReason = 'invalid_document' | 'duplicate_customer';
export type AsaasSubscriptionErrorReason = 'card_declined' | 'invalid_card' | 'invalid_holder_data';

/**
 * **Cobertura parcial, registrada de propósito.** Os códigos abaixo vêm da
 * documentação pública do Asaas para os fluxos de customer/cartão; não
 * foram todos exercitados contra o sandbox real ainda (isso é trabalho de
 * SET-34). Qualquer código não reconhecido cai em `null` — o adapter trata
 * `null` como o caso genérico `'error'`, nunca inventa um motivo específico
 * para um código que não confirmou.
 */
export function mapAsaasCustomerError(response: AsaasErrorResponseLike): AsaasCustomerErrorReason | null {
  const code = response.errors?.[0]?.code;
  switch (code) {
    case 'invalid_cpfCnpj':
    case 'invalid_document':
      return 'invalid_document';
    case 'duplicate_customer':
      return 'duplicate_customer';
    default:
      return null;
  }
}

export function mapAsaasSubscriptionError(response: AsaasErrorResponseLike): AsaasSubscriptionErrorReason | null {
  const code = response.errors?.[0]?.code;
  switch (code) {
    case 'invalid_creditCard':
      return 'invalid_card';
    case 'invalid_creditCardHolderInfo':
      return 'invalid_holder_data';
    case 'creditCard_declined':
    case 'declined':
      return 'card_declined';
    default:
      return null;
  }
}
