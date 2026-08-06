import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  mapActivateProductResult,
  mapSetActivationStatusResult,
} from '@/modules/representatives/infrastructure/map-product-activation-result';

describe('mapActivateProductResult', () => {
  it('maps an activated row to status "activated" with activationId', () => {
    const result = mapActivateProductResult([{ status: 'activated', activation_id: 'act-1' }], null);
    assert.deepEqual(result, { status: 'activated', activationId: 'act-1' });
  });

  it('maps an activated row with no activation_id to "error" — never fabricates an id', () => {
    const result = mapActivateProductResult([{ status: 'activated', activation_id: null }], null);
    assert.deepEqual(result, { status: 'error' });
  });

  for (const reason of [
    'representative_not_found',
    'product_not_found',
    'product_not_in_catalog',
  ] as const) {
    it(`maps the "${reason}" status to a typed rejection with that reason`, () => {
      const result = mapActivateProductResult([{ status: reason, activation_id: null }], null);
      assert.deepEqual(result, { status: 'rejected', reason });
    });
  }

  it('maps an unrecognised status string to "error" instead of guessing', () => {
    const result = mapActivateProductResult(
      [{ status: 'some_future_status_this_mapper_does_not_know_about', activation_id: null }],
      null,
    );
    assert.deepEqual(result, { status: 'error' });
  });

  it('does not accept set_activation_status\'s own success status as its own', () => {
    // 'updated' is the OTHER function's success value. Leaking it through as a
    // success here would mean the two mappers are interchangeable, which they
    // are not.
    const result = mapActivateProductResult([{ status: 'updated', activation_id: 'act-1' }], null);
    assert.deepEqual(result, { status: 'error' });
  });

  it('maps a null data array with no error to "error"', () => {
    assert.deepEqual(mapActivateProductResult(null, null), { status: 'error' });
  });

  it('maps an empty data array with no error to "error"', () => {
    assert.deepEqual(mapActivateProductResult([], null), { status: 'error' });
  });

  it('maps a non-null error to "error", regardless of data', () => {
    const result = mapActivateProductResult([{ status: 'activated', activation_id: 'act-1' }], {
      message: 'network error',
    });
    assert.deepEqual(result, { status: 'error' });
  });

  it('maps a non-null error with null data to "error"', () => {
    const result = mapActivateProductResult(null, {
      message: 'connection refused',
      code: 'ECONNREFUSED',
    });
    assert.deepEqual(result, { status: 'error' });
  });
});

describe('mapSetActivationStatusResult', () => {
  it('maps an updated row to status "updated" with activationId and publishedAt', () => {
    const result = mapSetActivationStatusResult(
      [{ status: 'updated', activation_id: 'act-1', published_at: '2026-08-07T12:00:00.000Z' }],
      null,
    );
    assert.deepEqual(result, {
      status: 'updated',
      activationId: 'act-1',
      publishedAt: '2026-08-07T12:00:00.000Z',
    });
  });

  it('passes a null published_at through on success — an activation that was never published has none', () => {
    const result = mapSetActivationStatusResult(
      [{ status: 'updated', activation_id: 'act-1', published_at: null }],
      null,
    );
    assert.deepEqual(result, { status: 'updated', activationId: 'act-1', publishedAt: null });
  });

  it('maps an updated row with no activation_id to "error" — never fabricates an id', () => {
    const result = mapSetActivationStatusResult(
      [{ status: 'updated', activation_id: null, published_at: null }],
      null,
    );
    assert.deepEqual(result, { status: 'error' });
  });

  for (const reason of [
    'representative_not_found',
    'not_activated',
    'invalid_status',
    'invalid_transition',
    'representative_not_active',
    'subscription_not_active',
    'display_name_required',
    'phone_required',
  ] as const) {
    it(`maps the "${reason}" status to a typed rejection with that reason`, () => {
      const result = mapSetActivationStatusResult(
        [{ status: reason, activation_id: 'act-1', published_at: null }],
        null,
      );
      assert.deepEqual(result, { status: 'rejected', reason });
    });
  }

  it('maps an unrecognised status string to "error" instead of guessing', () => {
    const result = mapSetActivationStatusResult(
      [
        {
          status: 'some_future_status_this_mapper_does_not_know_about',
          activation_id: 'act-1',
          published_at: null,
        },
      ],
      null,
    );
    assert.deepEqual(result, { status: 'error' });
  });

  it('does not accept activate_product\'s own success status as its own', () => {
    const result = mapSetActivationStatusResult(
      [{ status: 'activated', activation_id: 'act-1', published_at: null }],
      null,
    );
    assert.deepEqual(result, { status: 'error' });
  });

  it('maps a null data array with no error to "error"', () => {
    assert.deepEqual(mapSetActivationStatusResult(null, null), { status: 'error' });
  });

  it('maps an empty data array with no error to "error"', () => {
    assert.deepEqual(mapSetActivationStatusResult([], null), { status: 'error' });
  });

  it('maps a non-null error to "error", regardless of data', () => {
    const result = mapSetActivationStatusResult(
      [{ status: 'updated', activation_id: 'act-1', published_at: '2026-08-07T12:00:00.000Z' }],
      { message: 'network error' },
    );
    assert.deepEqual(result, { status: 'error' });
  });

  it('maps a non-null error with null data to "error"', () => {
    const result = mapSetActivationStatusResult(null, {
      message: 'connection refused',
      code: 'ECONNREFUSED',
    });
    assert.deepEqual(result, { status: 'error' });
  });
});
