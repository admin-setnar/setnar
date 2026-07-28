import { z } from 'zod';

import {
  hasLetterAndDigit,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/modules/auth/domain/auth-rules';

/**
 * Client-side validation for account creation.
 *
 * Rules come from the domain, never from literals typed here — the same
 * constants will drive server validation.
 */
export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(NAME_MIN_LENGTH, 'Informe o seu nome completo.')
      .max(NAME_MAX_LENGTH, 'Use no máximo 80 caracteres.'),
    email: z
      .string()
      .min(1, 'Informe o seu e-mail.')
      .email('Digite um e-mail válido, como nome@empresa.com.'),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use ao menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      .max(PASSWORD_MAX_LENGTH, 'A senha é longa demais.')
      .refine(hasLetterAndDigit, 'Combine letras e números.'),
    confirmPassword: z.string().min(1, 'Repita a senha para confirmar.'),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: 'É preciso aceitar os termos para criar a conta.' }),
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não são iguais.',
  });

export type SignUpFormValues = z.infer<typeof signUpSchema>;
