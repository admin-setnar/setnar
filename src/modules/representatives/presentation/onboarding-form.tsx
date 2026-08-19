'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { formatE164ToBRPhone, maskBRPhone } from '@/shared/domain/br-phone';
import { SITE_URL } from '@/config/site';
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
/** Same derivation `buildCommercialPageUrl` uses — the root host a slug is prefixed onto. */
const ROOT_HOST = new URL(SITE_URL).hostname;

/**
 * Display only — the Company shown in the live URL preview below, while
 * every Representative that registers is still automatically iGreen's. This
 * is NOT the authority for that association: `register_representative`
 * (`supabase/migrations/20260806000000_add_register_representative.sql:457`)
 * resolves `company_id` on its own, server-side, and remains the sole
 * source of truth. This constant is never sent anywhere — it exists only so
 * the preview shown here doesn't disagree with what registration actually
 * produces. Keep the two in sync by hand if the MVP's single Company ever
 * changes — the same trade-off already accepted elsewhere in this module
 * for other values that exist on both sides of the SQL/TypeScript boundary
 * (see `representative-rules.ts`, e.g. `DISPLAY_NAME_MAX_LENGTH`).
 */
const COMPANY_SLUG_PREVIEW = 'igreen';

export function OnboardingForm({
  initialDisplayName,
  initialPhone,
}: {
  initialDisplayName: string;
  initialPhone: string | null;
}) {
  const [failure, setFailure] = useState<RegisterRepresentativeFailure | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RepresentativeOnboardingFormValues>({
    resolver: zodResolver(representativeOnboardingSchema),
    defaultValues: {
      slug: '',
      displayName: initialDisplayName,
      authorizationId: '',
      phone: initialPhone ? formatE164ToBRPhone(initialPhone) : '',
      city: '',
    },
    mode: 'onBlur',
    shouldFocusError: true,
  });

  // Progressive mask on `phone` — same `onChange` interception as
  // `RepresentativeProfileForm`'s own `phone` field.
  const phoneField = register('phone');

  // Live URL preview for the `slug` field — lowercased the same way the
  // schema's own `.toLowerCase()` will before submit, so what's shown here
  // never disagrees with what actually gets registered.
  const slugPreview = watch('slug').trim().toLowerCase();
  const slugHint = slugPreview
    ? `Sua página ficará em ${slugPreview}.${COMPANY_SLUG_PREVIEW}.${ROOT_HOST}`
    : `Só letras minúsculas, números e hífen — ficará em algo como joao-silva.${COMPANY_SLUG_PREVIEW}.${ROOT_HOST}.`;

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
        hint={slugHint}
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

      <FormField
        label="Nome público"
        hint="Como você deseja aparecer para seus clientes."
        error={errors.displayName?.message}
      >
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

      <FormField label="Número de identificação" error={errors.authorizationId?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="off"
            placeholder="ID de licenciado"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('authorizationId')}
          />
        )}
      </FormField>

      <FormField
        label="Telefone comercial"
        hint="Usaremos este número no botão de WhatsApp das suas páginas."
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
