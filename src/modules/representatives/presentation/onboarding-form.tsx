'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { registerRepresentativeAction } from '@/modules/representatives/presentation/actions';
import {
  onboardingErrorCopy,
  type RegisterRepresentativeFailure,
} from '@/modules/representatives/presentation/representative-onboarding-error-messages';
import {
  representativeOnboardingSchema,
  type RepresentativeOnboardingFormValues,
} from '@/modules/representatives/presentation/schemas/representative-onboarding.schema';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormField } from '@/shared/ui/form-field';
import { Input } from '@/shared/ui/input';

/**
 * OnboardingForm
 *
 * Purpose: the D3.B.4 self-service registration step — turns a signed-in
 * User into a Representative by calling `registerRepresentativeAction`.
 * Same structure as `modules/auth/presentation/sign-up-form.tsx`:
 * `react-hook-form` + `zodResolver`, `shared/ui` primitives, `mode: 'onBlur'`.
 *
 * On `'rejected'`/`'error'`, shows a single `FormAlert` with the copy for
 * that outcome — deliberately does not try to guess which field to focus:
 * the 8 rejection reasons don't map 1:1 to one field obviously enough to do
 * that yet (e.g. `slug_invalid` covers both a bad format and a reserved
 * word, `company_not_found` maps to no field at all).
 *
 * D3.B.5: `registerRepresentativeAction` now `redirect()`s to `/app` on
 * success server-side (see that file's doc comment) — there is no
 * "created" render branch here anymore, same shape `SignUpForm` already has
 * for its own success path. A normal return from the action is therefore
 * always a `RegisterRepresentativeFailure` (`'rejected'` or `'error'`).
 */
export function OnboardingForm() {
  const [failure, setFailure] = useState<RegisterRepresentativeFailure | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RepresentativeOnboardingFormValues>({
    resolver: zodResolver(representativeOnboardingSchema),
    defaultValues: {
      slug: '',
      displayName: '',
      licenseId: '',
      phone: '',
      city: '',
    },
    mode: 'onBlur',
  });

  async function onSubmit(values: RepresentativeOnboardingFormValues) {
    setFailure(null);
    // A normal return here is always a failure — success redirects
    // server-side, inside registerRepresentativeAction.
    const result = await registerRepresentativeAction(values);
    setFailure(result);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {failure ? <FormAlert tone="error" {...onboardingErrorCopy(failure)} /> : null}

      <FormField
        label="Endereço da sua página"
        hint="Só letras minúsculas, números e hífen — ex.: joao-silva."
        error={errors.slug?.message}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="off"
            placeholder="joao-silva"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('slug')}
          />
        )}
      </FormField>

      <FormField label="Nome e sobrenome" error={errors.displayName?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="name"
            placeholder="Como você se apresenta aos clientes"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('displayName')}
          />
        )}
      </FormField>

      <FormField label="Número de identificação" error={errors.licenseId?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="off"
            placeholder="ID de licenciado"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('licenseId')}
          />
        )}
      </FormField>

      <FormField label="Telefone (opcional)" error={errors.phone?.message}>
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
            {...register('phone')}
          />
        )}
      </FormField>

      <FormField label="Cidade (opcional)" error={errors.city?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="address-level2"
            placeholder="Sua cidade"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('city')}
          />
        )}
      </FormField>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Criar minha página
      </Button>
    </form>
  );
}
