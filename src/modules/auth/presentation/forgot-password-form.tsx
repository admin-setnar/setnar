'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { AuthErrorCode } from '@/modules/auth/domain/auth';
import { requestPasswordResetAction } from '@/modules/auth/presentation/actions';
import { authErrorCopy } from '@/modules/auth/presentation/auth-error-messages';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/modules/auth/presentation/schemas/forgot-password.schema';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormField } from '@/shared/ui/form-field';
import { Input } from '@/shared/ui/input';

/**
 * ForgotPasswordForm
 *
 * The success copy deliberately never confirms or denies that the e-mail
 * has an account — same anti-enumeration principle `mapSupabaseAuthError`
 * already applies to login. This is safe by construction, not just careful
 * wording: `requestPasswordResetAction`/`SupabaseAuthGateway.requestPasswordReset`
 * never distinguish the two cases either (Supabase's own `error` is null for
 * both an existing and a non-existent e-mail), so there is no behavioural
 * difference this copy could accidentally leak.
 *
 * `initialFailureCode` (SET-40) seeds this same alert when the page itself
 * was reached via a failed `/auth/callback` redirect (wrong device, expired,
 * or already-used link) — the form doesn't need to know why, only that
 * `reset_link_expired` is the one code the page ever hands it.
 */
export function ForgotPasswordForm({
  initialFailureCode = null,
}: {
  initialFailureCode?: AuthErrorCode | null;
}) {
  const [failureCode, setFailureCode] = useState<AuthErrorCode | null>(initialFailureCode);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    setFailureCode(null);
    const result = await requestPasswordResetAction(values);
    if (result.status === 'error') {
      setFailureCode(result.code);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <FormAlert
        tone="success"
        title="Se este e-mail tiver uma conta, enviamos um link"
        description="Confira sua caixa de entrada (e o spam) para redefinir sua senha."
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {failureCode ? <FormAlert tone="error" {...authErrorCopy(failureCode)} /> : null}

      <FormField label="E-mail" error={errors.email?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('email')}
          />
        )}
      </FormField>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Enviar link de redefinição
      </Button>
    </form>
  );
}
