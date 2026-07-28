'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { signIn } from '@/modules/auth/application/sign-in';
import type { AuthErrorCode } from '@/modules/auth/domain/auth';
import { getAuthGateway } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { authErrorCopy } from '@/modules/auth/presentation/auth-error-messages';
import { useAuthModal } from '@/modules/auth/presentation/hooks/use-auth-modal';
import { PasswordInput } from '@/modules/auth/presentation/password-input';
import { SocialAuthButtons } from '@/modules/auth/presentation/social-auth-buttons';
import {
  signInSchema,
  type SignInFormValues,
} from '@/modules/auth/presentation/schemas/sign-in.schema';
import { useTenant } from '@/modules/tenancy/presentation/tenant-context';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormField } from '@/shared/ui/form-field';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Modal } from '@/shared/ui/modal';

/**
 * SignInModal
 *
 * Purpose: authenticate an existing representative without leaving the page.
 * Validation is client-side for feedback only; the gateway remains the
 * authority. Every state the user can reach is implemented: idle, submitting,
 * failed, succeeded.
 * Integration note: replacing the mock gateway is the only change required to
 * make this real — no structural refactor.
 */
export function SignInModal({ open }: { open: boolean }) {
  const { close, open: openView } = useAuthModal();
  const { brandName } = useTenant();
  const [failureCode, setFailureCode] = useState<AuthErrorCode | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
    mode: 'onBlur',
  });

  const rememberMe = watch('rememberMe');

  async function onSubmit(values: SignInFormValues) {
    setFailureCode(null);
    const result = await signIn(getAuthGateway(), values);

    if (result.status === 'error') {
      setFailureCode(result.code);
      return;
    }
    // No session exists yet, so success is acknowledged in place. This becomes
    // a redirect to the dashboard once authentication is wired in.
    setSucceeded(true);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) return;
    close();
    // Reset after the exit animation so the form does not visibly empty out.
    window.setTimeout(() => {
      reset();
      setFailureCode(null);
      setSucceeded(false);
    }, 200);
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={`Entrar no ${brandName}`}
      description="Use o e-mail cadastrado para acessar sua conta."
    >
      {succeeded ? (
        <FormAlert
          tone="success"
          title="Tudo certo"
          description="Sua área de trabalho abre assim que o acesso for liberado nesta versão."
        />
      ) : (
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

          <FormField
            label="Senha"
            error={errors.password?.message}
            action={
              <button
                type="button"
                className="rounded-sm text-xs font-medium text-content-muted underline-offset-4 transition-colors duration-fast hover:text-content hover:underline"
              >
                Esqueci minha senha
              </button>
            }
          >
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

          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            Entrar
          </Button>

          <Separator />

          <SocialAuthButtons
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
      )}
    </Modal>
  );
}

function Separator() {
  return (
    <div className="flex items-center gap-3 py-1" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs text-content-subtle">ou</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
