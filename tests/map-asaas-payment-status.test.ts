import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapAsaasPaymentStatus } from '@/modules/billing/infrastructure/fetch-asaas-latest-payment';

describe('mapAsaasPaymentStatus (SET-33)', () => {
  it('maps the three statuses apply_billing_event() knows how to act on', () => {
    assert.equal(mapAsaasPaymentStatus('CONFIRMED'), 'CONFIRMED');
    assert.equal(mapAsaasPaymentStatus('RECEIVED'), 'RECEIVED');
    assert.equal(mapAsaasPaymentStatus('OVERDUE'), 'OVERDUE');
  });

  it('maps every other documented Asaas payment status to "OTHER" — no entitlement transition defined for them', () => {
    const noActionStatuses = [
      'PENDING',
      'REFUNDED',
      'RECEIVED_IN_CASH',
      'REFUND_REQUESTED',
      'REFUND_IN_PROGRESS',
      'CHARGEBACK_REQUESTED',
      'CHARGEBACK_DISPUTE',
      'AWAITING_CHARGEBACK_REVERSAL',
      'DUNNING_REQUESTED',
      'DUNNING_RECEIVED',
      'AWAITING_RISK_ANALYSIS',
    ];
    for (const status of noActionStatuses) {
      assert.equal(mapAsaasPaymentStatus(status), 'OTHER', `status=${status}`);
    }
  });

  it('maps an unrecognized or missing status to "OTHER" instead of throwing', () => {
    assert.equal(mapAsaasPaymentStatus('SOME_FUTURE_STATUS_ASAAS_ADDS'), 'OTHER');
    assert.equal(mapAsaasPaymentStatus(undefined), 'OTHER');
  });
});
