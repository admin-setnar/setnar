import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveReconciliationPlan, type ReconcilableSubscription } from '@/modules/billing/application/reconcile-subscription';
import type { GetLatestPaymentResult } from '@/modules/billing/domain/payment-gateway';

const subscription: ReconcilableSubscription = {
  id: 'sub-local-1',
  externalSubscriptionId: 'sub_asaas_1',
  externalCustomerId: 'cus_asaas_1',
};

describe('resolveReconciliationPlan (SET-33/SET-34)', () => {
  it('logs "gateway_error" without ever building an event, when the Asaas lookup itself failed', () => {
    const latestPayment: GetLatestPaymentResult = { status: 'error' };
    const plan = resolveReconciliationPlan(subscription, latestPayment, true);
    assert.deepEqual(plan, { action: 'log', outcome: 'gateway_error', detail: { subscriptionId: 'sub-local-1' } });
  });

  it('logs "no_payment_found" when Asaas has no payment at all for this subscription', () => {
    const latestPayment: GetLatestPaymentResult = { status: 'not_found' };
    const plan = resolveReconciliationPlan(subscription, latestPayment, true);
    assert.deepEqual(plan, { action: 'log', outcome: 'no_payment_found', detail: { subscriptionId: 'sub-local-1' } });
  });

  it('logs "ignored" for a payment status with no defined entitlement transition (SET-25)', () => {
    const latestPayment: GetLatestPaymentResult = {
      status: 'found',
      paymentId: 'pay_1',
      paymentStatus: 'OTHER',
      customerId: 'cus_asaas_1',
      dueDate: null,
    };
    const plan = resolveReconciliationPlan(subscription, latestPayment, true);
    assert.equal(plan.action, 'log');
    assert.equal(plan.outcome, 'ignored');
    assert.deepEqual(plan.detail, {
      subscriptionId: 'sub-local-1',
      paymentId: 'pay_1',
      paymentStatus: 'OTHER',
      note: 'status do Asaas sem transição de entitlement definida (SET-25) — nada a aplicar',
    });
  });

  for (const [paymentStatus, eventType] of [
    ['CONFIRMED', 'PAYMENT_CONFIRMED'],
    ['RECEIVED', 'PAYMENT_RECEIVED'],
    ['OVERDUE', 'PAYMENT_OVERDUE'],
  ] as const) {
    it(`maps ${paymentStatus} to ${eventType} and only logs "would_apply" in dry-run mode, never building an event`, () => {
      const latestPayment: GetLatestPaymentResult = {
        status: 'found',
        paymentId: 'pay_2',
        paymentStatus,
        customerId: 'cus_from_asaas',
        dueDate: '2026-09-15',
      };
      const plan = resolveReconciliationPlan(subscription, latestPayment, false);
      assert.deepEqual(plan, {
        action: 'log',
        outcome: 'would_apply',
        detail: { subscriptionId: 'sub-local-1', paymentId: 'pay_2', paymentStatus, eventType },
      });
    });

    it(`builds an apply_billing_event-shaped event for ${paymentStatus} when --apply is set`, () => {
      const latestPayment: GetLatestPaymentResult = {
        status: 'found',
        paymentId: 'pay_3',
        paymentStatus,
        customerId: 'cus_from_asaas',
        dueDate: '2026-09-15',
      };
      const plan = resolveReconciliationPlan(subscription, latestPayment, true);
      assert.equal(plan.action, 'apply');
      assert.deepEqual(plan.event, {
        eventId: 'pay_3',
        eventType,
        asaasSubscriptionId: 'sub_asaas_1',
        asaasCustomerId: 'cus_from_asaas',
        nextDueDate: '2026-09-15',
      });
      assert.deepEqual(plan.detail, { subscriptionId: 'sub-local-1', paymentId: 'pay_3', paymentStatus, eventType });
    });
  }

  it('falls back to the subscription\'s own external customer id when the Asaas payment carries none', () => {
    const latestPayment: GetLatestPaymentResult = {
      status: 'found',
      paymentId: 'pay_4',
      paymentStatus: 'CONFIRMED',
      customerId: null,
      dueDate: null,
    };
    const plan = resolveReconciliationPlan(subscription, latestPayment, true);
    assert.equal(plan.action, 'apply');
    assert.equal(plan.event.asaasCustomerId, 'cus_asaas_1', 'never lose the customer id already on file');
    assert.equal(plan.event.nextDueDate, null);
  });

  it('always uses the real Asaas payment id as the synthetic event id — dedup relies on it', () => {
    const latestPayment: GetLatestPaymentResult = {
      status: 'found',
      paymentId: 'pay_unique_asaas_id',
      paymentStatus: 'RECEIVED',
      customerId: null,
      dueDate: null,
    };
    const plan = resolveReconciliationPlan(subscription, latestPayment, true);
    assert.equal(plan.action, 'apply');
    assert.equal(plan.event.eventId, 'pay_unique_asaas_id');
  });
});
