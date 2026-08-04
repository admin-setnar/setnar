import { z } from 'zod';

import {
  AUTHORIZATION_ID_MAX_LENGTH,
  BR_PHONE_PATTERN,
  CITY_MAX_LENGTH,
} from '@/modules/representatives/domain/representative-rules';

/**
 * Client-side validation for the D5b profile edit form. Re-validated
 * server-side in `presentation/actions.ts` with this exact same schema —
 * same split `representativeOnboardingSchema`/`registerRepresentativeAction`
 * already use.
 *
 * Only the 3 fields `update_representative_profile` accepts — `slug` and
 * `displayName` are deliberately absent, same scope boundary the SQL
 * function's own header documents (regra 12 for `slug`; `displayName` is not
 * part of D5b at all).
 */
export const representativeProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(BR_PHONE_PATTERN, 'Digite um telefone válido, como (11) 98888-7777.')
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .trim()
    .max(CITY_MAX_LENGTH, `Use no máximo ${CITY_MAX_LENGTH} caracteres.`)
    .optional()
    .or(z.literal('')),
  authorizationId: z
    .string()
    .trim()
    .min(1, 'Informe o número de identificação.')
    .max(AUTHORIZATION_ID_MAX_LENGTH, `Use no máximo ${AUTHORIZATION_ID_MAX_LENGTH} caracteres.`),
});

export type RepresentativeProfileFormValues = z.infer<typeof representativeProfileSchema>;
