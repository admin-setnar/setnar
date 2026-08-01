import { z } from 'zod';

import {
  BR_PHONE_PATTERN,
  LEAD_CITY_MAX_LENGTH,
  LEAD_HONEYPOT_FIELD,
  LEAD_NAME_MAX_LENGTH,
  LEAD_NAME_MIN_LENGTH,
} from '@/modules/leads/domain/lead-rules';

/**
 * Client-side validation for the minimal lead form on a Commercial Page.
 * Re-validated server-side in `app/api/leads/route.ts` with this exact same
 * schema — client validation is for feedback, the route is what actually
 * guarantees nothing malformed reaches `submit_lead`, same split
 * `modules/auth/presentation/actions.ts` already uses for auth forms.
 *
 * Only `nome` and `telefone` are required, matching
 * `templates/commercial-pages/ConexaoGreen/index.html`'s own form
 * (`cidade`/`email` are marked "(opcional)" there too).
 */
export const leadSubmissionSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(LEAD_NAME_MIN_LENGTH, 'Informe o seu nome.')
    .max(LEAD_NAME_MAX_LENGTH, 'Use no máximo 80 caracteres.'),
  telefone: z
    .string()
    .trim()
    .regex(BR_PHONE_PATTERN, 'Digite um telefone válido, como (11) 98888-7777.'),
  cidade: z
    .string()
    .trim()
    .max(LEAD_CITY_MAX_LENGTH, 'Use no máximo 120 caracteres.')
    .optional()
    .or(z.literal('')),
  email: z.string().trim().email('Digite um e-mail válido.').optional().or(z.literal('')),
  // Honeypot — never shown to or filled by a real visitor. Not validated as
  // an error; the route handler checks it separately and, if non-empty,
  // responds exactly like a successful submission (no signal to a bot that
  // it was caught).
  [LEAD_HONEYPOT_FIELD]: z.string().optional(),
});

export type LeadSubmissionFormValues = z.infer<typeof leadSubmissionSchema>;
