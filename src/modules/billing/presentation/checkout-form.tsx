'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { LAUNCH_PRICE_LABEL } from '@/modules/billing/domain/billing-rules';
import { startCheckoutAction } from '@/modules/billing/presentation/actions';
import { checkoutErrorCopy, type StartCheckoutFailure } from '@/modules/billing/presentation/checkout-error-messages';
import { checkoutSchema, type CheckoutFormValues } from '@/modules/billing/presentation/schemas/checkout.schema';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormField } from '@/shared/ui/form-field';
import { Input } from '@/shared/ui/input';

/**
 * Formulário de checkout (SET-28). Só coleta o necessário para criar o
 * "customer" no Asaas — nome, documento, e-mail, CEP e número do endereço
 * (o Asaas resolve logradouro/bairro/cidade/UF a partir do CEP; telefone
 * reaproveita o já cadastrado no onboarding, não é pedido aqui). O cartão é
 * digitado na página hospedada do Asaas, nunca aqui (ver
 * `domain/payment-gateway.ts` para o porquê). Em caso de sucesso,
 * `startCheckoutAction` já faz o `redirect()` para lá — este componente só
 * precisa tratar a falha; não existe um branch de "sucesso" para renderizar,
 * a navegação acontece antes disso.
 */
export function CheckoutForm() {
  const [failure, setFailure] = useState<StartCheckoutFailure | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onBlur',
    shouldFocusError: true,
  });

  async function onSubmit(values: CheckoutFormValues) {
    setFailure(null);
    const result = await startCheckoutAction(values);
    if (result) setFailure(result);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {failure ? <FormAlert tone="error" {...checkoutErrorCopy(failure)} /> : null}

      <FormField label="Nome completo" error={errors.holderName?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="name"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('holderName')}
          />
        )}
      </FormField>

      <FormField label="CPF ou CNPJ" error={errors.holderDocumentId?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="off"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('holderDocumentId')}
          />
        )}
      </FormField>

      <FormField label="E-mail" error={errors.holderEmail?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('holderEmail')}
          />
        )}
      </FormField>

      <FormField label="CEP" error={errors.postalCode?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="postal-code"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('postalCode')}
          />
        )}
      </FormField>

      <FormField label="Número do endereço" error={errors.addressNumber?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoComplete="address-line2"
            aria-describedby={describedBy}
            invalid={invalid}
            disabled={isSubmitting}
            {...register('addressNumber')}
          />
        )}
      </FormField>

      <p className="text-sm text-content-muted">
        Você será redirecionado para o ambiente seguro de pagamento para informar os dados do cartão.
      </p>

      <Button type="submit" size="md" loading={isSubmitting}>
        Assinar por {LAUNCH_PRICE_LABEL}
      </Button>
    </form>
  );
}
