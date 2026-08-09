import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cancelSubscription } from '@/modules/billing/application/cancel-subscription';
import type { CancelSubscriptionResult, PaymentGateway } from '@/modules/billing/domain/payment-gateway';
import type {
  ConfirmCancellationResult,
  PrepareCancellationResult,
  SubscriptionGateway,
} from '@/modules/billing/domain/subscription-gateway';

function fakeSubscriptionGateway(overrides: Partial<SubscriptionGateway> = {}): SubscriptionGateway {
  return {
    reserveCheckoutSlot: () => {
      throw new Error('not used by cancelSubscription');
    },
    prepareCancellation: () => Promise.resolve({ status: 'cancelable', externalSubscriptionId: 'sub_123' }),
    confirmCancellation: () => Promise.resolve({ status: 'canceled' }),
    ...overrides,
  };
}

function fakePaymentGateway(overrides: Partial<PaymentGateway> = {}): PaymentGateway {
  return {
    createCustomer: () => {
      throw new Error('not used by cancelSubscription');
    },
    createCheckout: () => {
      throw new Error('not used by cancelSubscription');
    },
    cancelSubscription: () => Promise.resolve({ status: 'canceled' }),
    ...overrides,
  };
}

describe('cancelSubscription (application)', () => {
  it('happy path: cancels on the gateway, then confirms locally', async () => {
    let gatewayCalledWith: string | null = null;
    let confirmCalled = false;
    const subscriptionGateway = fakeSubscriptionGateway({
      confirmCancellation: () => {
        confirmCalled = true;
        return Promise.resolve({ status: 'canceled' });
      },
    });
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: (id) => {
        gatewayCalledWith = id;
        return Promise.resolve({ status: 'canceled' });
      },
    });

    const result = await cancelSubscription(subscriptionGateway, () => paymentGateway);
    assert.deepEqual(result, { status: 'canceled' });
    assert.equal(gatewayCalledWith, 'sub_123');
    assert.equal(confirmCalled, true);
  });

  it('short-circuits on "already_canceled" without ever calling the payment gateway', async () => {
    let gatewayCalled = false;
    const subscriptionGateway = fakeSubscriptionGateway({
      prepareCancellation: () => Promise.resolve({ status: 'already_canceled' }),
    });
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: () => {
        gatewayCalled = true;
        return Promise.resolve({ status: 'canceled' });
      },
    });

    const result = await cancelSubscription(subscriptionGateway, () => paymentGateway);
    assert.deepEqual(result, { status: 'already_canceled' });
    assert.equal(gatewayCalled, false);
  });

  it('passes through "not_found" from prepare without calling the payment gateway', async () => {
    let gatewayCalled = false;
    const subscriptionGateway = fakeSubscriptionGateway({
      prepareCancellation: () => Promise.resolve({ status: 'not_found' }),
    });
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: () => {
        gatewayCalled = true;
        return Promise.resolve({ status: 'canceled' });
      },
    });

    const result = await cancelSubscription(subscriptionGateway, () => paymentGateway);
    assert.deepEqual(result, { status: 'not_found' });
    assert.equal(gatewayCalled, false);
  });

  it('skips the payment gateway entirely when there is no external id to cancel (manual/fixture rows)', async () => {
    let gatewayCalled = false;
    let gatewayConstructed = false;
    const subscriptionGateway = fakeSubscriptionGateway({
      prepareCancellation: () => Promise.resolve({ status: 'cancelable', externalSubscriptionId: null }),
    });
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: () => {
        gatewayCalled = true;
        return Promise.resolve({ status: 'canceled' });
      },
    });

    const result = await cancelSubscription(subscriptionGateway, () => {
      // Achado no smoke test manual: o construtor real (`getPaymentGateway`
      // do factory) lança se ASAAS_API_KEY/ASAAS_BASE_URL não estiverem
      // configuradas — mesmo num caminho que nunca usaria o gateway. Não
      // basta o *método* nunca ser chamado, o *construtor* também não pode
      // ser invocado.
      gatewayConstructed = true;
      return paymentGateway;
    });
    assert.deepEqual(result, { status: 'canceled' });
    assert.equal(gatewayConstructed, false);
    assert.equal(gatewayCalled, false);
  });

  it('treats a gateway "not_found" (already gone on Asaas) as success and still confirms locally', async () => {
    let confirmCalled = false;
    const subscriptionGateway = fakeSubscriptionGateway({
      confirmCancellation: () => {
        confirmCalled = true;
        return Promise.resolve({ status: 'canceled' });
      },
    });
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: (): Promise<CancelSubscriptionResult> => Promise.resolve({ status: 'not_found' }),
    });

    const result = await cancelSubscription(subscriptionGateway, () => paymentGateway);
    assert.deepEqual(result, { status: 'canceled' });
    assert.equal(confirmCalled, true);
  });

  it('never confirms locally when the payment gateway fails — no false success', async () => {
    let confirmCalled = false;
    const subscriptionGateway = fakeSubscriptionGateway({
      confirmCancellation: () => {
        confirmCalled = true;
        return Promise.resolve({ status: 'canceled' });
      },
    });
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: (): Promise<CancelSubscriptionResult> => Promise.resolve({ status: 'error' }),
    });

    const result = await cancelSubscription(subscriptionGateway, () => paymentGateway);
    assert.deepEqual(result, { status: 'error' });
    assert.equal(confirmCalled, false);
  });

  it('surfaces an error from the local confirmation step without masking it as success', async () => {
    const subscriptionGateway = fakeSubscriptionGateway({
      confirmCancellation: (): Promise<ConfirmCancellationResult> => Promise.resolve({ status: 'error' }),
    });
    const paymentGateway = fakePaymentGateway();

    const result = await cancelSubscription(subscriptionGateway, () => paymentGateway);
    assert.deepEqual(result, { status: 'error' });
  });

  it('propagates a prepare-step error without attempting any write', async () => {
    let gatewayCalled = false;
    let confirmCalled = false;
    const subscriptionGateway = fakeSubscriptionGateway({
      prepareCancellation: (): Promise<PrepareCancellationResult> => Promise.resolve({ status: 'error' }),
      confirmCancellation: () => {
        confirmCalled = true;
        return Promise.resolve({ status: 'canceled' });
      },
    });
    const paymentGateway = fakePaymentGateway({
      cancelSubscription: () => {
        gatewayCalled = true;
        return Promise.resolve({ status: 'canceled' });
      },
    });

    const result = await cancelSubscription(subscriptionGateway, () => paymentGateway);
    assert.deepEqual(result, { status: 'error' });
    assert.equal(gatewayCalled, false);
    assert.equal(confirmCalled, false);
  });
});
