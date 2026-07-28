'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { signUp } from '@/modules/auth/application/sign-up';
import type { AuthErrorCode } from '@/modules/auth/domain/auth';
import { PASSWORD_MIN_LENGTH } from '@/modules/auth/domain/auth-rules';
import { getAuthGateway } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { authErrorCopy } from '@/modules/auth/presentation/auth-error-messages';
import { useAuthModal } from '@/modules/auth/presentation/hooks/use-auth-modal';
import { PasswordInput } from '@/modules/auth/presentation/password-input';
import {
  signUpSchema,
  type SignUpFormValues,
} from '@/modules/auth/presentation/schemas/sign-up.schema';
import { useTenant } from '@/modules/tenancy/presentation/tenant-context';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormField } from '@/shared/ui/form-field';
import { Input } from '@/shared/ui/input';
import { Modal } from '@/shared/ui/modal';

/**
 * SignUpModal
 *
 * Purpose: self-service account creation — the primary conversion event of the
 * gateway page.
 * Conversion note: the form asks for the minimum needed to create an account.
 * Anything else (WhatsApp, representative id, products) belongs to onboarding,
 * after the user has committed, not before.
 * Compliance note: accepting the terms is required and is enforced in the
 * sign-up use case as well as here.
 */
export function SignUpModal({ open }: { open: boolean }) {
  const { close, open: openView } = useAuthModal();
  const { brandName, legal } = useTenant();
  const [failureCode, setFailureCode] = useState<AuthErrorCode | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      // Consent is never pre-granted. The cast is needed because the schema
      // types this field as the literal `true` once valid.
      acceptedTerms: false as unknown as true,
    },
    mode: 'onBlur',
  });

  const acceptedTerms = watch('acceptedTerms');

  async function onSubmit(values: SignUpFormValues) {
    setFailureCode(null);
    const result = await signUp(getAuthGateway(), {
      name: values.name,
      email: values.email,
      password: values.password,
      acceptedTerms: values.acceptedTerms,
    });

    if (result.status === 'error') {
      setFailureCode(result.code);
      return;
    }
    setSucceeded(true);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) return;
    close();
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
      title={`Criar conta no ${brandName}`}
      description="Leva menos de dois minutos. Você configura seus produtos logo depois."
    >
      {succeeded ? (
        <FormAlert
          tone="success"
          title="Conta pronta para ser criada"
          description="O cadastro será concluído assim que a ativação estiver liberada nesta versão."
        />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {failureCode ? <FormAlert tone="error" {...authErrorCopy(failureCode)} /> : null}

          <FormField label="Nome completo" error={errors.name?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                autoComplete="name"
                placeholder="Como você se apresenta aos clientes"
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={isSubmitting}
                {...register('name')}
              />
            )}
          </FormField>

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
            hint={`Ao menos ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`}
            error={errors.password?.message}
          >
            {({ id, describedBy, invalid }) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                placeholder="Crie uma senha"
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={isSubmitting}
                {...register('password')}
              />
            )}
          </FormField>

          <FormField label="Confirmar senha" error={errors.confirmPassword?.message}>
            {({ id, describedBy, invalid }) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                placeholder="Repita a senha"
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={isSubmitting}
                {...register('confirmPassword')}
              />
            )}
          </FormField>

          <div className="flex items-start gap-2.5">
            <Checkbox
              id="sign-up-terms"
              className="mt-0.5"
              checked={acceptedTerms === true}
              disabled={isSubmitting}
              aria-describedby={errors.acceptedTerms ? 'sign-up-terms-error' : undefined}
              onCheckedChange={(checked) =>
                setValue('acceptedTerms', (checked === true) as true, { shouldValidate: true })
              }
            />
            <div className="space-y-1">
              <label htmlFor="sign-up-terms" className="text-sm leading-snug text-content-muted">
                Li e aceito os{' '}
                <a href={legal.termsUrl} className="text-content underline underline-offset-4">
                  termos de uso
                </a>{' '}
                e a{' '}
                <a href={legal.privacyUrl} className="text-content underline underline-offset-4">
                  política de privacidade
                </a>
                .
              </label>
              {errors.acceptedTerms ? (
                <p id="sign-up-terms-error" role="alert" className="text-xs font-medium text-danger">
                  {errors.acceptedTerms.message}
                </p>
              ) : null}
            </div>
          </div>

          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            Criar conta
          </Button>

          <p className="pt-1 text-center text-sm text-content-muted">
            Já usa o {brandName}?{' '}
            <button
              type="button"
              onClick={() => openView('sign-in')}
              className="rounded-sm font-medium text-content underline-offset-4 hover:underline"
            >
              Entrar
            </button>
          </p>
        </form>
      )}
    </Modal>
  );
}
