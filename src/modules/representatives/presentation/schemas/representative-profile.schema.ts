import { z } from 'zod';

import {
  AUTHORIZATION_ID_MAX_LENGTH,
  BR_PHONE_PATTERN,
  CITY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  hasAtLeastTwoWords,
} from '@/modules/representatives/domain/representative-rules';

/**
 * Client-side validation for the D5b profile edit form. Re-validated
 * server-side in `presentation/actions.ts` with this exact same schema —
 * same split `representativeOnboardingSchema`/`registerRepresentativeAction`
 * already use.
 *
 * The 4 fields `update_representative_profile` accepts. `slug` remains
 * deliberately absent; `displayName` is the editable public identity and is
 * independent from `profiles.full_name`.
 */
export const representativeProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Informe o nome público.')
    .max(DISPLAY_NAME_MAX_LENGTH, `Use no máximo ${DISPLAY_NAME_MAX_LENGTH} caracteres.`)
    .refine(hasAtLeastTwoWords, 'Informe nome e sobrenome.'),
  phone: z
    .string()
    .trim()
    .min(1, 'Informe o telefone comercial.')
    .regex(BR_PHONE_PATTERN, 'Digite um telefone válido, como (11) 98888-7777.'),
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
