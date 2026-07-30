import { z } from 'zod';

/** Client-side validation for the "forgot password" request form. */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe o seu e-mail.')
    .email('Digite um e-mail válido, como nome@empresa.com.'),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
