'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { AuthErrorCode } from '@/modules/auth/domain/auth';
import { PASSWORD_MIN_LENGTH } from '@/modules/auth/domain/auth-rules';
import { signUpAction } from '@/modules/auth/presentation/actions';
import { authErrorCopy } from '@/modules/auth/presentation/auth-error-messages';
import { useAuthModal } from '@/modules/auth/presentation/hooks/use-auth-modal';
import { PasswordInput } from '@/modules/auth/presentation/password-input';
import { safeClientAuthCall } from '@/modules/auth/presentation/safe-client-auth-call';
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
import { maskBRPhone } from '@/shared/domain/br-phone';

/**
 * SignUpForm
 *
 * Purpose: self-service account creation — the primary conversion event of
 * the gateway page. Shared, unmodified, between the sign-up modal and the
 * standalone `/criar-conta` route.
 * Conversion note: the form asks only for the account identity, commercial
 * phone and consent. Representative id and products belong to onboarding,
 * after the user has committed, not before.
 * Compliance note: accepting the terms is required and is enforced in the
 * sign-up use case as well as here.
 *
 * `next` (Sprint B): same as `SignInForm` — where to land after a successful
 * sign-up; success now navigates via the Server Action's own `redirect()`,
 * so there is no "authenticated" render branch here anymore.
 * The operational setup keeps Confirm email off (see the Supabase README),
 * while `awaitingConfirmation` safely handles a no-session signup if the
 * external project configuration differs or changes.
 */
export function SignUpForm({ next }: { next?: string } = {}) {
  const { open: openView } = useAuthModal();
  const { brandName, legal } = useTenant();
  const [failureCode, setFailureCode] = useState<AuthErrorCode | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<{
    name: string;
    email: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      phone: '',
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
  const phoneField = register('phone');

  async function onSubmit(values: SignUpFormValues) {
    setFailureCode(null);
    // Reached on failure or on the no-session safety seam; success redirects
    // server-side.
    const result = await safeClientAuthCall(() => signUpAction(values, next));

    if (result.status === 'pending_confirmation') {
      setAwaitingConfirmation({ name: result.name, email: result.email });
      return;
    }
    setFailureCode(result.code);
  }

  if (awaitingConfirmation) {
    return (
      <FormAlert
        tone="success"
        title={`Quase lá, ${awaitingConfirmation.name}`}
        description={`Enviamos um e-mail de confirmação para ${awaitingConfirmation.email}. Clique no link para ativar sua conta.`}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {failureCode ? <FormAlert tone="error" {...authErrorCopy(failureCode)} /> : null}
      {isSubmitting ? (
        <p role="status" className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-content-muted">
          Criando sua conta. Em seguida, você vai configurar suas páginas.
        </p>
      ) : null}

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

      <FormField
        label="Telefone comercial"
        hint="Este número será usado no botão de WhatsApp das suas páginas."
        error={errors.phone?.message}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 98888-7777"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            required
            {...phoneField}
            onChange={(event) => {
              event.target.value = maskBRPhone(event.target.value);
              return phoneField.onChange(event);
            }}
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
        {isSubmitting ? 'Criando conta...' : 'Criar conta'}
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
  );
}
