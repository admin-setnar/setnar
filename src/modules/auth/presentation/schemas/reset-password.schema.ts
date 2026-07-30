import { z } from 'zod';

import {
  hasLetterAndDigit,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/modules/auth/domain/auth-rules';

/**
 * Client-side validation for setting a new password (reset flow, final
 * step). Same strength rule as sign-up — a fresh password deserves the full
 * check, unlike sign-in's deliberately looser schema for existing accounts.
 */
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use ao menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      .max(PASSWORD_MAX_LENGTH, 'A senha é longa demais.')
      .refine(hasLetterAndDigit, 'Combine letras e números.'),
    confirmPassword: z.string().min(1, 'Repita a senha para confirmar.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não são iguais.',
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
