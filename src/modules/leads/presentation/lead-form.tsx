'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { LEAD_HONEYPOT_FIELD } from '@/modules/leads/domain/lead-rules';
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
 */
export function LeadForm({ productSlug }: { productSlug: string }) {
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
        description="Em breve alguém entra em contato."
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
            {...register('telefone')}
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
            {...register('email')}
          />
        )}
      </FormField>

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Quero saber mais
      </Button>
    </form>
  );
}
