import { z } from 'zod';

import { PASSWORD_MAX_LENGTH } from '@/modules/auth/domain/auth-rules';

/**
 * Client-side validation for sign in.
 *
 * Deliberately looser than the sign-up schema: an existing account may have
 * been created under older rules, and telling a returning user their password
 * is "weak" is both wrong and unhelpful. The server remains the authority.
 */
export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe o seu e-mail.')
    .email('Digite um e-mail válido, como nome@empresa.com.'),
  password: z
    .string()
    .min(1, 'Informe a sua senha.')
    .max(PASSWORD_MAX_LENGTH, 'A senha é longa demais.'),
  rememberMe: z.boolean(),
});

export type SignInFormValues = z.infer<typeof signInSchema>;
