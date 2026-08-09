import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  mapConfirmCancellationResult,
  mapPrepareCancellationResult,
  mapReserveCheckoutSlotResult,
} from '@/modules/billing/infrastructure/map-subscription-gateway-result';

const fakeError = { message: 'boom', code: 'PGRST000' } as unknown as Parameters<
  typeof mapReserveCheckoutSlotResult
>[1];

describe('mapReserveCheckoutSlotResult', () => {
  it('maps "reserved" with its id and amount', () => {
    const result = mapReserveCheckoutSlotResult([{ id: 'sub-1', status: 'reserved', amount_cents: 2790 }], null);
    assert.deepEqual(result, { status: 'reserved', localSubscriptionId: 'sub-1', amountCents: 2790 });
  });

  it('falls back to "error" when "reserved" is missing id/amount', () => {
    assert.deepEqual(mapReserveCheckoutSlotResult([{ id: null, status: 'reserved', amount_cents: 2790 }], null), {
      status: 'error',
    });
    assert.deepEqual(mapReserveCheckoutSlotResult([{ id: 'sub-1', status: 'reserved', amount_cents: null }], null), {
      status: 'error',
    });
  });

  it('maps the other known outcomes', () => {
    assert.deepEqual(mapReserveCheckoutSlotResult([{ id: null, status: 'already_active', amount_cents: null }], null), {
      status: 'already_active',
    });
    assert.deepEqual(mapReserveCheckoutSlotResult([{ id: null, status: 'sold_out', amount_cents: null }], null), {
      status: 'sold_out',
    });
    assert.deepEqual(
      mapReserveCheckoutSlotResult([{ id: null, status: 'representative_not_found', amount_cents: null }], null),
      { status: 'representative_not_found' },
    );
  });

  it('maps an RPC/network error or an empty row to "error"', () => {
    assert.deepEqual(mapReserveCheckoutSlotResult(null, fakeError), { status: 'error' });
    assert.deepEqual(mapReserveCheckoutSlotResult([], null), { status: 'error' });
    assert.deepEqual(mapReserveCheckoutSlotResult([{ id: null, status: 'unknown', amount_cents: null }], null), {
      status: 'error',
    });
  });
});

describe('mapPrepareCancellationResult', () => {
  it('maps "cancelable" with its external id, including null (manual/fixture rows)', () => {
    assert.deepEqual(
      mapPrepareCancellationResult([{ status: 'cancelable', external_subscription_id: 'sub_123' }], null),
      { status: 'cancelable', externalSubscriptionId: 'sub_123' },
    );
    assert.deepEqual(mapPrepareCancellationResult([{ status: 'cancelable', external_subscription_id: null }], null), {
      status: 'cancelable',
      externalSubscriptionId: null,
    });
  });

  it('maps "already_canceled" and "not_found"', () => {
    assert.deepEqual(
      mapPrepareCancellationResult([{ status: 'already_canceled', external_subscription_id: null }], null),
      { status: 'already_canceled' },
    );
    assert.deepEqual(mapPrepareCancellationResult([{ status: 'not_found', external_subscription_id: null }], null), {
      status: 'not_found',
    });
  });

  it('maps an RPC/network error, an empty row, or an unknown status to "error"', () => {
    assert.deepEqual(mapPrepareCancellationResult(null, fakeError), { status: 'error' });
    assert.deepEqual(mapPrepareCancellationResult([], null), { status: 'error' });
    assert.deepEqual(mapPrepareCancellationResult([{ status: 'unknown', external_subscription_id: null }], null), {
      status: 'error',
    });
  });
});

describe('mapConfirmCancellationResult', () => {
  it('maps "canceled", "already_canceled", and "not_found"', () => {
    assert.deepEqual(mapConfirmCancellationResult([{ status: 'canceled' }], null), { status: 'canceled' });
    assert.deepEqual(mapConfirmCancellationResult([{ status: 'already_canceled' }], null), {
      status: 'already_canceled',
    });
    assert.deepEqual(mapConfirmCancellationResult([{ status: 'not_found' }], null), { status: 'not_found' });
  });

  it('maps an RPC/network error, an empty row, or an unknown status to "error"', () => {
    assert.deepEqual(mapConfirmCancellationResult(null, fakeError), { status: 'error' });
    assert.deepEqual(mapConfirmCancellationResult([], null), { status: 'error' });
    assert.deepEqual(mapConfirmCancellationResult([{ status: 'unknown' }], null), { status: 'error' });
  });
});
