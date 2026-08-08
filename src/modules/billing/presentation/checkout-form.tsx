'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { LAUNCH_PRICE_LABEL } from '@/modules/billing/domain/billing-rules';
import { startCheckoutAction } from '@/modules/billing/presentation/actions';
import { checkoutErrorCopy, type StartCheckoutFailure } from '@/modules/billing/presentation/checkout-error-messages';
import { checkoutSchema, type CheckoutFormValues } from '@/modules/billing/presentation/schemas/checkout.schema';
import { maskBRPhone } from '@/shared/domain/br-phone';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';
import { FormField } from '@/shared/ui/form-field';
import { Input } from '@/shared/ui/input';

/**
 * Formulário de checkout (SET-28). Sucesso deixa a Subscription em
 * `'pending'` — nenhum redirecionamento, nenhuma promessa de acesso
 * imediato; o texto de sucesso é explícito sobre isso (ver
 * `BILLING_DECISIONS_PLAN.md`, "redirect não concede entitlement"). A
 * página de conta (`page.tsx`) é quem decide, na próxima renderização, se
 * mostra este formulário de novo ou o estado "aguardando confirmação".
 */
export function CheckoutForm() {
  const [failure, setFailure] = useState<StartCheckoutFailure | null>(null);
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onBlur',
    shouldFocusError: true,
  });

  const phoneField = register('holderPhone');

  async function onSubmit(values: CheckoutFormValues) {
    setFailure(null);
    const result = await startCheckoutAction(values);
    if (result) {
      setFailure(result);
    } else {
      setPending(true);
    }
  }

  if (pending) {
    return (
      <FormAlert
        tone="success"
        title="Pagamento em processamento"
        description="Assim que a confirmação chegar do meio de pagamento, sua assinatura é ativada automaticamente — isso pode levar alguns minutos."
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {failure ? <FormAlert tone="error" {...checkoutErrorCopy(failure)} /> : null}

      <div className="space-y-4">
        <p className="text-sm font-medium text-content">Dados do cartão</p>

        <FormField label="Nome impresso no cartão" error={errors.cardHolderName?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              autoComplete="cc-name"
              aria-describedby={describedBy}
              invalid={invalid}
              disabled={isSubmitting}
              {...register('cardHolderName')}
            />
          )}
        </FormField>

        <FormField label="Número do cartão" error={errors.cardNumber?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              aria-describedby={describedBy}
              invalid={invalid}
              disabled={isSubmitting}
              {...register('cardNumber')}
            />
          )}
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Mês" error={errors.cardExpiryMonth?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="cc-exp-month"
                placeholder="MM"
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={isSubmitting}
                {...register('cardExpiryMonth')}
              />
            )}
          </FormField>
          <FormField label="Ano" error={errors.cardExpiryYear?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="cc-exp-year"
                placeholder="AAAA"
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={isSubmitting}
                {...register('cardExpiryYear')}
              />
            )}
          </FormField>
          <FormField label="CVV" error={errors.cardCcv?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={isSubmitting}
                {...register('cardCcv')}
              />
            )}
          </FormField>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium text-content">Dados do titular</p>

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

        <FormField label="Telefone" error={errors.holderPhone?.message}>
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

        <div className="grid grid-cols-2 gap-3">
          <FormField label="CEP" error={errors.holderPostalCode?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="postal-code"
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={isSubmitting}
                {...register('holderPostalCode')}
              />
            )}
          </FormField>
          <FormField label="Número do endereço" error={errors.holderAddressNumber?.message}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                autoComplete="address-line2"
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={isSubmitting}
                {...register('holderAddressNumber')}
              />
            )}
          </FormField>
        </div>
      </div>

      <Button type="submit" size="md" loading={isSubmitting}>
        Assinar por {LAUNCH_PRICE_LABEL}
      </Button>
    </form>
  );
}
