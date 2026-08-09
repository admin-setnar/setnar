import { z } from 'zod';

/**
 * Formato mínimo que confiamos de um evento de webhook do Asaas (SET-29/30).
 * `.passthrough()` em todo objeto aninhado de propósito — a própria doc do
 * Asaas avisa que novos campos podem ser adicionados sem aviso
 * (`docs.asaas.com/docs/checkout-events`), e este schema só precisa dos
 * poucos campos que `apply_billing_event()` consome, nunca do formato
 * completo. Só `id`/`event` são exigidos; tudo em `payment`/`checkout` é
 * opcional e lido defensivamente na rota — o payload cru inteiro é gravado
 * em `billing_events.payload` de qualquer forma, então nenhum dado se perde
 * se um campo aqui não bater exatamente com o formato real.
 */
const asaasSubscriptionRefSchema = z
  .object({
    id: z.string().optional(),
    nextDueDate: z.string().optional(),
  })
  .passthrough();

export const asaasWebhookSchema = z
  .object({
    id: z.string().min(1),
    event: z.string().min(1),
    payment: z
      .object({
        id: z.string().optional(),
        subscription: z.string().optional(),
        customer: z.string().optional(),
        externalReference: z.string().optional(),
        nextDueDate: z.string().optional(),
      })
      .passthrough()
      .optional(),
    checkout: z
      .object({
        id: z.string().optional(),
        customer: z.string().optional(),
        externalReference: z.string().optional(),
        subscription: z.union([z.string(), asaasSubscriptionRefSchema]).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type AsaasWebhookPayload = z.infer<typeof asaasWebhookSchema>;
