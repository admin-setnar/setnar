import { z } from 'zod';

import { DOCUMENT_ID_PATTERN, stripNonDigits } from '@/modules/billing/domain/billing-rules';

/**
 * Validação do formulário de checkout (SET-28). Revalidada no Server Action
 * com este mesmo schema.
 *
 * **Só três campos, de propósito.** A versão original deste schema também
 * coletava dados de cartão (número, validade, CVV) e endereço do titular —
 * removidos na revisão que trocou o envio de cartão inline pelo Checkout
 * Asaas hospedado (ver `domain/payment-gateway.ts`). O cartão é digitado na
 * página do Asaas, não aqui; este formulário só cria o "customer" no Asaas
 * antes do redirecionamento.
 */
export const checkoutSchema = z.object({
  holderName: z.string().trim().min(1, 'Informe seu nome completo.').max(120),
  holderDocumentId: z
    .string()
    .transform(stripNonDigits)
    .refine((value) => DOCUMENT_ID_PATTERN.test(value), 'Informe um CPF ou CNPJ válido.'),
  holderEmail: z.string().trim().email('Informe um e-mail válido.'),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
