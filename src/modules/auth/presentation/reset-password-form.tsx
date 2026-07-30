'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { AuthErrorCode } from '@/modules/auth/domain/auth';
import { PASSWORD_MIN_LENGTH } from '@/modules/auth/domain/auth-rules';
import { updatePasswordAction } from '@/modules/auth/presentation/actions';
import { authErrorCopy } from '@/modules/auth/presentation/auth-error-messages';
import { PasswordInput } from '@/modules/auth/presentation/password-input';
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/modules/auth/presentation/schemas/reset-password.schema';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormField } from '@/shared/ui/form-field';

/**
 * ResetPasswordForm
 *
 * Requires the session `app/auth/callback/route.ts` already established —
 * this form has no e-mail field and no idea whose password it is changing;
 * that identity comes entirely from the session cookie. If that session is
 * missing, expired, or the link was already used, `updatePasswordAction`
 * returns `reset_link_expired`, not a generic failure — the two need
 * different next steps (request a new link vs. try again).
 * No "authenticated" render branch: success redirects to `/app` server-side.
 */
export function ResetPasswordForm() {
  const [failureCode, setFailureCode] = useState<AuthErrorCode | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    setFailureCode(null);
    // Only ever reached on failure — success redirects server-side.
    const result = await updatePasswordAction(values);
    setFailureCode(result.code);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {failureCode ? <FormAlert tone="error" {...authErrorCopy(failureCode)} /> : null}

      <FormField
        label="Nova senha"
        hint={`Ao menos ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`}
        error={errors.password?.message}
      >
        {({ id, describedBy, invalid }) => (
          <PasswordInput
            id={id}
            autoComplete="new-password"
            placeholder="Crie uma nova senha"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('password')}
          />
        )}
      </FormField>

      <FormField label="Confirmar nova senha" error={errors.confirmPassword?.message}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput
            id={id}
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('confirmPassword')}
          />
        )}
      </FormField>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Salvar nova senha
      </Button>
    </form>
  );
}
