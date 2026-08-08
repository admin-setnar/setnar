import { z } from 'zod';

import { DOCUMENT_ID_PATTERN, POSTAL_CODE_PATTERN, stripNonDigits } from '@/modules/billing/domain/billing-rules';
import { BR_PHONE_PATTERN, formatPhoneToE164 } from '@/shared/domain/br-phone';

const currentYear = new Date().getFullYear();

/**
 * Validação do formulário de checkout (SET-28). Revalidada no Server Action
 * com este mesmo schema — mesmo split que todo outro formulário deste
 * projeto já usa (`representativeProfileSchema`, etc.).
 *
 * Todos os campos de cartão/titular existem só para esta submissão — nada
 * aqui é persistido em `representatives` nem em nenhuma outra tabela além
 * de, no máximo, os ids externos que o Asaas devolve
 * (`record_billing_external_ids`). O próprio cartão nunca é armazenado
 * localmente.
 */
export const checkoutSchema = z.object({
  cardHolderName: z.string().trim().min(1, 'Informe o nome como está no cartão.').max(120),
  cardNumber: z
    .string()
    .transform(stripNonDigits)
    .refine((value) => value.length >= 13 && value.length <= 19, 'Número de cartão inválido.'),
  cardExpiryMonth: z
    .string()
    .regex(/^(0[1-9]|1[0-2])$/, 'Mês inválido.'),
  cardExpiryYear: z
    .string()
    .regex(/^\d{4}$/, 'Ano inválido.')
    .refine((value) => Number(value) >= currentYear, 'Ano inválido.'),
  cardCcv: z.string().regex(/^\d{3,4}$/, 'Código de segurança inválido.'),
  holderName: z.string().trim().min(1, 'Informe seu nome completo.').max(120),
  holderDocumentId: z
    .string()
    .transform(stripNonDigits)
    .refine((value) => DOCUMENT_ID_PATTERN.test(value), 'Informe um CPF ou CNPJ válido.'),
  holderEmail: z.string().trim().email('Informe um e-mail válido.'),
  holderPhone: z
    .string()
    .trim()
    .regex(BR_PHONE_PATTERN, 'Digite um telefone válido, como (11) 98888-7777.'),
  holderPostalCode: z
    .string()
    .transform(stripNonDigits)
    .refine((value) => POSTAL_CODE_PATTERN.test(value), 'Informe um CEP válido.'),
  holderAddressNumber: z.string().trim().min(1, 'Informe o número do endereço.').max(20),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;

/**
 * Traduz os valores do formulário (já validados) para o formato que
 * `startCheckout()` espera — separado do schema para o schema não precisar
 * saber o vocabulário exato do domínio (`CardDetails`/`CardHolderInfo`).
 */
export function toStartCheckoutInput(values: CheckoutFormValues) {
  return {
    card: {
      holderName: values.cardHolderName,
      number: values.cardNumber,
      expiryMonth: values.cardExpiryMonth,
      expiryYear: values.cardExpiryYear,
      ccv: values.cardCcv,
    },
    cardHolder: {
      name: values.holderName,
      documentId: values.holderDocumentId,
      email: values.holderEmail,
      phone: formatPhoneToE164(values.holderPhone),
      postalCode: values.holderPostalCode,
      addressNumber: values.holderAddressNumber,
    },
  };
}
