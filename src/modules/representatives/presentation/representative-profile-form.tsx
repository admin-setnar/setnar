'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { Representative } from '@/modules/representatives/domain/representative';
import { formatE164ToBRPhone, maskBRPhone } from '@/modules/representatives/domain/representative-rules';
import { updateRepresentativeProfileAction } from '@/modules/representatives/presentation/actions';
import {
  representativeProfileErrorCopy,
  type UpdateRepresentativeProfileFailure,
} from '@/modules/representatives/presentation/representative-profile-error-messages';
import {
  representativeProfileSchema,
  type RepresentativeProfileFormValues,
} from '@/modules/representatives/presentation/schemas/representative-profile.schema';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormField } from '@/shared/ui/form-field';
import { Input } from '@/shared/ui/input';

/**
 * RepresentativeProfileForm — D5b.
 *
 * Same `react-hook-form` + `zodResolver` shape as `OnboardingForm`, adapted
 * for the two ways this form differs from it:
 *
 *   - Pre-filled, not blank: `defaultValues` reads from the `representative`
 *     prop, since this is an EDIT of a row that already exists, not a
 *     one-time creation. `phone` needs `formatE164ToBRPhone` because the
 *     stored value is E.164 and the input/`BR_PHONE_PATTERN` expect the BR
 *     mask — the same asymmetry `updateRepresentativeProfileAction` already
 *     handles on the way back out.
 *   - No `redirect()` on success: `updateRepresentativeProfileAction`
 *     returns `null` for success (see that action's doc comment for why),
 *     so THIS component is what shows the outcome, via a `FormAlert
 *     tone="success"` — unlike `OnboardingForm`, which never renders a
 *     success branch because Next's own navigation is the success feedback
 *     there.
 */
export function RepresentativeProfileForm({ representative }: { representative: Representative }) {
  const [failure, setFailure] = useState<UpdateRepresentativeProfileFailure | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RepresentativeProfileFormValues>({
    resolver: zodResolver(representativeProfileSchema),
    defaultValues: {
      phone: representative.phone ? formatE164ToBRPhone(representative.phone) : '',
      city: representative.city ?? '',
      licenseId: representative.licenseId,
    },
    mode: 'onBlur',
  });

  // Progressive mask on `phone` — same `onChange` interception as
  // `LeadForm`'s own `telefone` field (`modules/leads/presentation/lead-form.tsx`):
  // mutate the DOM value before handing the event to RHF's `onChange`, so
  // paste/autofill get masked too, not just individual keystrokes.
  const phoneField = register('phone');

  async function onSubmit(values: RepresentativeProfileFormValues) {
    setFailure(null);
    setSaved(false);
    const result = await updateRepresentativeProfileAction(values);
    if (result) {
      setFailure(result);
    } else {
      setSaved(true);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {failure ? <FormAlert tone="error" {...representativeProfileErrorCopy(failure)} /> : null}
      {saved ? <FormAlert tone="success" title="Perfil atualizado." /> : null}

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

      <Button type="submit" size="md" loading={isSubmitting}>
        Salvar
      </Button>
    </form>
  );
}
