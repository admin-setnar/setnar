import { z } from 'zod';

import {
  AUTHORIZATION_ID_MAX_LENGTH,
  BR_PHONE_PATTERN,
  CITY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  hasAtLeastTwoWords,
  REPRESENTATIVE_SLUG_PATTERN,
} from '@/modules/representatives/domain/representative-rules';

/**
 * Client-side validation for the Representative onboarding form. Re-validated
 * server-side in `presentation/actions.ts` with this exact same schema —
 * client validation is for feedback, the Server Action is what actually
 * guarantees nothing malformed reaches `registerRepresentative` — same split
 * `sign-up.schema.ts`/`signUpAction` already use.
 *
 * `slug` is normalized to lowercase here (`.toLowerCase()`), not just
 * rejected when uppercase: friendlier for a human typing a subdomain label
 * without changing what's actually validated — `register_representative`'s
 * own format check is case-sensitive against the same lowercase-only
 * pattern, so a value this schema accepts is guaranteed to already be in the
 * shape the server expects.
 */
export const representativeOnboardingSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Escolha um endereço.')
    .regex(REPRESENTATIVE_SLUG_PATTERN, 'Use apenas letras minúsculas, números e hífen.'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Informe seu nome e sobrenome.')
    .max(DISPLAY_NAME_MAX_LENGTH, `Use no máximo ${DISPLAY_NAME_MAX_LENGTH} caracteres.`)
    .refine(hasAtLeastTwoWords, 'Informe nome e sobrenome.'),
  authorizationId: z
    .string()
    .trim()
    .min(1, 'Informe o número de identificação.')
    .max(AUTHORIZATION_ID_MAX_LENGTH, `Use no máximo ${AUTHORIZATION_ID_MAX_LENGTH} caracteres.`),
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
});

export type RepresentativeOnboardingFormValues = z.infer<typeof representativeOnboardingSchema>;
