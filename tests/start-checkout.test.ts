import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { startCheckout, type StartCheckoutInput } from '@/modules/billing/application/start-checkout';
import type { CancelSubscriptionResult, PaymentGateway } from '@/modules/billing/domain/payment-gateway';
import type { ReserveCheckoutSlotResult, SubscriptionGateway } from '@/modules/billing/domain/subscription-gateway';

const input: StartCheckoutInput = {
  holderName: 'Maria Teste',
  holderDocumentId: '12345678901',
  holderEmail: 'maria@example.invalid',
  holderPhone: '11987654321',
  postalCode: '01310100',
  addressNumber: '100',
  callback: {
    successUrl: 'https://app.setnar.com/app/conta?checkout=success',
    cancelUrl: 'https://app.setnar.com/app/conta?checkout=canceled',
    expiredUrl: 'https://app.setnar.com/app/conta?checkout=expired',
  },
};

function fakeSubscriptionGateway(overrides: Partial<SubscriptionGateway> = {}): SubscriptionGateway {
  return {
    reserveCheckoutSlot: (): Promise<ReserveCheckoutSlotResult> =>
      Promise.resolve({
        status: 'reserved',
        localSubscriptionId: 'sub-local-1',
        amountCents: 2790,
        staleExternalSubscriptionId: null,
      }),
    prepareCancellation: () => {
      throw new Error('not used by startCheckout');
    },
    confirmCancellation: () => {
      throw new Error('not used by startCheckout');
    },
    ...overrides,
  };
}

function fakePaymentGateway(overrides: Partial<PaymentGateway> = {}): PaymentGateway {
  return {
    createCustomer: () => Promise.resolve({ status: 'created', externalCustomerId: 'cus_1' }),
    createCheckout: () => Promise.resolve({ status: 'created', checkoutUrl: 'https://asaas.test/c/1', externalCheckoutId: 'chk_1' }),
    cancelSubscription: () => Promise.resolve({ status: 'canceled' }),
    getLatestPayment: () => {
      throw new Error('not used by startCheckout');
    },
    ...overrides,
  };
}

describe('startCheckout (application)', () => {
  it('never calls the payment gateway cancelSubscription for a brand-new reservation', async () => {
    let cancelCalled = false;
    const subscriptionGateway = fakeSubscriptionGateway();
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: () => {
        cancelCalled = true;
        return Promise.resolve({ status: 'canceled' });
      },
    });

    const result = await startCheckout(subscriptionGateway, paymentGateway, input);
    assert.equal(result.status, 'redirect');
    assert.equal(cancelCalled, false);
  });

  it('cancels the stale Asaas subscription before creating the new checkout, on a reused-row retry', async () => {
    const calls: string[] = [];
    const subscriptionGateway = fakeSubscriptionGateway({
      reserveCheckoutSlot: () =>
        Promise.resolve({
          status: 'reserved',
          localSubscriptionId: 'sub-local-1',
          amountCents: 2790,
          staleExternalSubscriptionId: 'sub_stale',
        }),
    });
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: (id): Promise<CancelSubscriptionResult> => {
        calls.push(`cancel:${id}`);
        return Promise.resolve({ status: 'canceled' });
      },
      createCustomer: () => {
        calls.push('createCustomer');
        return Promise.resolve({ status: 'created', externalCustomerId: 'cus_1' });
      },
    });

    const result = await startCheckout(subscriptionGateway, paymentGateway, input);
    assert.equal(result.status, 'redirect');
    assert.deepEqual(calls, ['cancel:sub_stale', 'createCustomer'], 'cancels the old subscription before creating the new customer/checkout');
  });

  it('still creates the new checkout even when canceling the stale subscription fails — best effort, never blocks retry', async () => {
    const subscriptionGateway = fakeSubscriptionGateway({
      reserveCheckoutSlot: () =>
        Promise.resolve({
          status: 'reserved',
          localSubscriptionId: 'sub-local-1',
          amountCents: 2790,
          staleExternalSubscriptionId: 'sub_stale',
        }),
    });
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: (): Promise<CancelSubscriptionResult> => Promise.resolve({ status: 'error' }),
    });

    const result = await startCheckout(subscriptionGateway, paymentGateway, input);
    assert.equal(result.status, 'redirect');
  });

  it('treats a "not_found" stale cancellation (already gone on Asaas) the same as success', async () => {
    const subscriptionGateway = fakeSubscriptionGateway({
      reserveCheckoutSlot: () =>
        Promise.resolve({
          status: 'reserved',
          localSubscriptionId: 'sub-local-1',
          amountCents: 2790,
          staleExternalSubscriptionId: 'sub_stale',
        }),
    });
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: (): Promise<CancelSubscriptionResult> => Promise.resolve({ status: 'not_found' }),
    });

    const result = await startCheckout(subscriptionGateway, paymentGateway, input);
    assert.equal(result.status, 'redirect');
  });

  it('passes through "already_active" and "sold_out" without touching the payment gateway', async () => {
    let paymentGatewayTouched = false;
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: () => {
        paymentGatewayTouched = true;
        return Promise.resolve({ status: 'canceled' });
      },
      createCustomer: () => {
        paymentGatewayTouched = true;
        return Promise.resolve({ status: 'created', externalCustomerId: 'cus_1' });
      },
    });

    const alreadyActive = await startCheckout(
      fakeSubscriptionGateway({ reserveCheckoutSlot: () => Promise.resolve({ status: 'already_active' }) }),
      paymentGateway,
      input,
    );
    assert.deepEqual(alreadyActive, { status: 'already_active' });

    const soldOut = await startCheckout(
      fakeSubscriptionGateway({ reserveCheckoutSlot: () => Promise.resolve({ status: 'sold_out' }) }),
      paymentGateway,
      input,
    );
    assert.deepEqual(soldOut, { status: 'sold_out' });

    assert.equal(paymentGatewayTouched, false);
  });
});
