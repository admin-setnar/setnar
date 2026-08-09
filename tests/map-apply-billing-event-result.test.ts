import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PostgrestError } from '@supabase/supabase-js';

import { mapApplyBillingEventResult } from '@/modules/billing/infrastructure/map-apply-billing-event-result';

const NETWORK_ERROR = new PostgrestError({ message: 'network error', details: '', hint: '', code: '' });

describe('mapApplyBillingEventResult', () => {
  it('maps an applied row with a subscription_id to status "applied"', () => {
    const result = mapApplyBillingEventResult([{ outcome: 'applied', subscription_id: 'sub-1' }], null);
    assert.deepEqual(result, { status: 'applied', subscriptionId: 'sub-1' });
  });

  it('maps an applied row with no subscription_id to "error" — never fabricates an id', () => {
    const result = mapApplyBillingEventResult([{ outcome: 'applied', subscription_id: null }], null);
    assert.deepEqual(result, { status: 'error' });
  });

  for (const outcome of ['duplicate', 'ignored', 'unmatched'] as const) {
    it(`maps the "${outcome}" outcome through as-is`, () => {
      const result = mapApplyBillingEventResult([{ outcome, subscription_id: null }], null);
      assert.deepEqual(result, { status: outcome });
    });
  }

  it('maps an unrecognised outcome string to "error" instead of guessing', () => {
    const result = mapApplyBillingEventResult(
      [{ outcome: 'some_future_outcome_this_mapper_does_not_know_about', subscription_id: null }],
      null,
    );
    assert.deepEqual(result, { status: 'error' });
  });

  it('maps a null data array with no error to "error"', () => {
    assert.deepEqual(mapApplyBillingEventResult(null, null), { status: 'error' });
  });

  it('maps an empty data array with no error to "error"', () => {
    assert.deepEqual(mapApplyBillingEventResult([], null), { status: 'error' });
  });

  it('maps a non-null error to "error", regardless of data', () => {
    const result = mapApplyBillingEventResult([{ outcome: 'applied', subscription_id: 'sub-1' }], NETWORK_ERROR);
    assert.deepEqual(result, { status: 'error' });
  });
});
