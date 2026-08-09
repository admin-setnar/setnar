import { z } from 'zod';

import { DOCUMENT_ID_PATTERN, POSTAL_CODE_PATTERN, stripNonDigits } from '@/modules/billing/domain/billing-rules';

/**
 * Validação do formulário de checkout (SET-28). Revalidada no Server Action
 * com este mesmo schema.
 *
 * **Cinco campos, de propósito.** A versão original deste schema também
 * coletava dados de cartão (número, validade, CVV) — removidos na revisão
 * que trocou o envio de cartão inline pelo Checkout Asaas hospedado (ver
 * `domain/payment-gateway.ts`). O cartão é digitado na página do Asaas, não
 * aqui. `postalCode`/`addressNumber` entraram depois (achado testando o
 * checkout real): o Asaas exige que o customer tenha endereço para uma
 * cobrança recorrente — enviando só CEP + número, o próprio Asaas resolve
 * logradouro/bairro/cidade/UF, então não é preciso pedir mais que isso.
 * `holderPhone` não é coletado aqui — reaproveita o telefone comercial que o
 * representante já informou no onboarding (`start-checkout.ts`), não faz
 * sentido perguntar de novo.
 */
export const checkoutSchema = z.object({
  holderName: z.string().trim().min(1, 'Informe seu nome completo.').max(120),
  holderDocumentId: z
    .string()
    .transform(stripNonDigits)
    .refine((value) => DOCUMENT_ID_PATTERN.test(value), 'Informe um CPF ou CNPJ válido.'),
  holderEmail: z.string().trim().email('Informe um e-mail válido.'),
  postalCode: z
    .string()
    .transform(stripNonDigits)
    .refine((value) => POSTAL_CODE_PATTERN.test(value), 'Informe um CEP válido.'),
  addressNumber: z.string().trim().min(1, 'Informe o número do endereço.').max(20),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
