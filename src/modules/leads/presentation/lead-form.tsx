'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { LEAD_HONEYPOT_FIELD, maskBRPhone } from '@/modules/leads/domain/lead-rules';
import {
  leadSubmissionSchema,
  type LeadSubmissionFormValues,
} from '@/modules/leads/presentation/schemas/lead.schema';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormField } from '@/shared/ui/form-field';
import { Input } from '@/shared/ui/input';

type SubmitState = 'idle' | 'success' | 'error';

/**
 * Minimal lead-capture form for a Commercial Page — `nome`/`telefone`
 * required, `cidade`/`email` optional, matching
 * `templates/commercial-pages/ConexaoGreen/index.html`'s own form fields
 * exactly (see the ADR in README.md for why those four and not others).
 * Posts to `app/api/leads/route.ts`, never inserts into `leads` directly —
 * that table has no INSERT policy on purpose.
 *
 * `disabled` (SET-36): the private preview renders this same form so the
 * owner sees an equivalent page, but `/api/leads` resolves the destination
 * Representative from the request's own `Host` header
 * (`resolveRepresentativeActivation`, published-only) — the preview is
 * served from SETNAR's own domain, not the Representative's subdomain, so a
 * real submission from there would always 404. Disabling every field and
 * the submit button (rather than hiding the form) keeps the preview visually
 * equivalent to the real page while making it structurally impossible to
 * trigger that confusing failure.
 */
export function LeadForm({
  productSlug,
  disabled = false,
  submitLabel = 'Quero saber mais',
  successDescription = 'Em breve alguém entra em contato.',
}: {
  productSlug: string;
  disabled?: boolean;
  submitLabel?: string;
  successDescription?: string;
}) {
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadSubmissionFormValues>({
    resolver: zodResolver(leadSubmissionSchema),
    defaultValues: { nome: '', telefone: '', cidade: '', email: '', [LEAD_HONEYPOT_FIELD]: '' },
    mode: 'onBlur',
  });

  // Progressive mask on `telefone` — `onChange` (not `onKeyUp`) so paste and
  // autofill get masked too, not just individual keystrokes. Mutating
  // `event.target.value` before handing the event to RHF's own `onChange`
  // is the standard way to mask an RHF-registered (uncontrolled) input: RHF
  // reads the DOM node's current value, which is the one this just set.
  const telefoneField = register('telefone');

  async function onSubmit(values: LeadSubmissionFormValues) {
    setSubmitState('idle');
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          productSlug,
          origem: 'commercial_page',
        }),
      });
      if (!response.ok) {
        setSubmitState('error');
        return;
      }
      setSubmitState('success');
      reset();
    } catch {
      setSubmitState('error');
    }
  }

  if (submitState === 'success') {
    return (
      <FormAlert
        tone="success"
        title="Recebemos seus dados"
        description={successDescription}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {submitState === 'error' ? (
        <FormAlert
          tone="error"
          title="Não foi possível enviar agora"
          description="Tente novamente em instantes."
        />
      ) : null}

      {/* Honeypot — invisible and untabbable for a real visitor, matching
          templates/commercial-pages/ConexaoGreen/index.html:165. A bot that
          fills every field in a scraped form trips this one. */}
      <p aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Não preencha isto:
          <input tabIndex={-1} autoComplete="off" {...register(LEAD_HONEYPOT_FIELD)} />
        </label>
      </p>

      <FormField label="Nome" error={errors.nome?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="name"
            placeholder="Seu nome"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={disabled || isSubmitting}
            {...register('nome')}
          />
        )}
      </FormField>

      <FormField label="Telefone" error={errors.telefone?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 98888-7777"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={disabled || isSubmitting}
            {...telefoneField}
            onChange={(event) => {
              event.target.value = maskBRPhone(event.target.value);
              return telefoneField.onChange(event);
            }}
          />
        )}
      </FormField>

      <FormField label="Cidade / Estado" hint="Opcional" error={errors.cidade?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="address-level2"
            placeholder="Ex: Curitiba/PR"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={disabled || isSubmitting}
            {...register('cidade')}
          />
        )}
      </FormField>

      <FormField label="E-mail" hint="Opcional" error={errors.email?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={disabled || isSubmitting}
            {...register('email')}
          />
        )}
      </FormField>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={disabled}>
        {submitLabel}
      </Button>
      {disabled ? (
        <p className="text-center text-xs text-content-subtle">
          Formulário desativado na prévia — publique a página para receber contatos reais.
        </p>
      ) : null}
    </form>
  );
}
