/**
 * Forma mínima de uma resposta de erro do Asaas
 * (`{"errors":[{"code":"...","description":"..."}]}`, documentada em
 * docs.asaas.com). Tipo estrutural próprio, não importado de um SDK — este
 * projeto não depende do SDK do Asaas, só chama a REST API via `fetch`
 * (ver `asaas-payment-gateway.ts`).
 */
export interface AsaasErrorResponseLike {
  readonly errors?: ReadonlyArray<{ readonly code?: string; readonly description?: string }>;
}

export type AsaasCustomerErrorReason = 'invalid_document' | 'duplicate_customer';
export type AsaasCheckoutErrorReason = 'invalid_customer';

/**
 * **Cobertura parcial, registrada de propósito.** Os códigos abaixo vêm da
 * documentação pública do Asaas; não foram todos exercitados contra o
 * sandbox real ainda (isso é trabalho de SET-34). Código não reconhecido
 * cai em `null` — o adapter trata `null` como o caso genérico `'error'`,
 * nunca inventa um motivo específico para um código que não confirmou.
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

export function mapAsaasCheckoutError(response: AsaasErrorResponseLike): AsaasCheckoutErrorReason | null {
  const code = response.errors?.[0]?.code;
  switch (code) {
    case 'invalid_customer':
      return 'invalid_customer';
    default:
      return null;
  }
}
