'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { AuthErrorCode } from '@/modules/auth/domain/auth';
import { signInAction } from '@/modules/auth/presentation/actions';
import { authErrorCopy } from '@/modules/auth/presentation/auth-error-messages';
import { useAuthModal } from '@/modules/auth/presentation/hooks/use-auth-modal';
import { PasswordInput } from '@/modules/auth/presentation/password-input';
import { SocialAuthButtons } from '@/modules/auth/presentation/social-auth-buttons';
import {
  signInSchema,
  type SignInFormValues,
} from '@/modules/auth/presentation/schemas/sign-in.schema';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormField } from '@/shared/ui/form-field';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

/**
 * SignInForm
 *
 * Purpose: authenticate an existing representative. Shared, unmodified,
 * between the sign-in modal and the standalone `/entrar` route — the two
 * places `AuthGateway` decisions say this exact form must render.
 * Validation is client-side for feedback only; the Server Action re-validates
 * and is the actual authority.
 *
 * `next` (Sprint B): where to land after a successful sign-in — the
 * standalone `/entrar` route passes its own `?next=` through (already
 * validated server-side by `safeRedirectTarget` inside `signInAction`,
 * never trusted here); the modal usage passes nothing, defaulting to `/app`.
 * There is no "authenticated" render branch anymore: success now navigates
 * via the Server Action's own `redirect()`, so `onSubmit` only ever sees a
 * failure back.
 */
export function SignInForm({ next }: { next?: string } = {}) {
  const { open: openView } = useAuthModal();
  const [failureCode, setFailureCode] = useState<AuthErrorCode | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
    mode: 'onBlur',
  });

  const rememberMe = watch('rememberMe');

  async function onSubmit(values: SignInFormValues) {
    setFailureCode(null);
    // Only ever reached on failure — success redirects server-side.
    const result = await signInAction(values, next);
    setFailureCode(result.code);
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

      <FormField label="Senha" error={errors.password?.message}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput
            id={id}
            autoComplete="current-password"
            placeholder="Sua senha"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('password')}
          />
        )}
      </FormField>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="sign-in-remember"
            checked={rememberMe}
            disabled={isSubmitting}
            onCheckedChange={(checked) => setValue('rememberMe', checked === true)}
          />
          <Label htmlFor="sign-in-remember" className="font-normal text-content-muted">
            Lembrar-me neste dispositivo
          </Label>
        </div>
        <Link
          href="/esqueci-senha"
          className="rounded-sm text-sm font-medium text-content underline-offset-4 hover:underline"
        >
          Esqueci minha senha
        </Link>
      </div>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Entrar
      </Button>

      <SocialAuthButtons
        next={next}
        disabled={isSubmitting}
        onFailure={(code) => setFailureCode(code as AuthErrorCode)}
      />

      <p className="pt-1 text-center text-sm text-content-muted">
        Ainda não tem conta?{' '}
        <button
          type="button"
          onClick={() => openView('sign-up')}
          className="rounded-sm font-medium text-content underline-offset-4 hover:underline"
        >
          Criar conta
        </button>
      </p>
    </form>
  );
}
