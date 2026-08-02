import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapRegisterRepresentativeResult } from '@/modules/representatives/infrastructure/map-register-representative-result';

describe('mapRegisterRepresentativeResult', () => {
  it('maps a created row to status "created" with representativeId', () => {
    const result = mapRegisterRepresentativeResult(
      [{ status: 'created', representative_id: 'rep-123' }],
      null,
    );
    assert.deepEqual(result, { status: 'created', representativeId: 'rep-123' });
  });

  it('maps a created row with no representative_id to "error" — never fabricates an id', () => {
    const result = mapRegisterRepresentativeResult([{ status: 'created', representative_id: null }], null);
    assert.deepEqual(result, { status: 'error' });
  });

  for (const reason of [
    'company_not_found',
    'already_registered',
    'slug_invalid',
    'slug_taken',
    'display_name_invalid',
    'license_id_invalid',
    'phone_invalid',
    'city_invalid',
  ] as const) {
    it(`maps the "${reason}" status to a typed rejection with that reason`, () => {
      const result = mapRegisterRepresentativeResult([{ status: reason, representative_id: null }], null);
      assert.deepEqual(result, { status: 'rejected', reason });
    });
  }

  it('maps an unrecognised status string to "error" instead of guessing', () => {
    const result = mapRegisterRepresentativeResult(
      [{ status: 'some_future_status_this_mapper_does_not_know_about', representative_id: null }],
      null,
    );
    assert.deepEqual(result, { status: 'error' });
  });

  it('maps a null data array with no error to "error"', () => {
    const result = mapRegisterRepresentativeResult(null, null);
    assert.deepEqual(result, { status: 'error' });
  });

  it('maps an empty data array with no error to "error"', () => {
    const result = mapRegisterRepresentativeResult([], null);
    assert.deepEqual(result, { status: 'error' });
  });

  it('maps a non-null error to "error", regardless of data', () => {
    const result = mapRegisterRepresentativeResult(
      [{ status: 'created', representative_id: 'rep-123' }],
      { message: 'network error' },
    );
    assert.deepEqual(result, { status: 'error' });
  });

  it('maps a non-null error with null data to "error"', () => {
    const result = mapRegisterRepresentativeResult(null, { message: 'connection refused', code: 'ECONNREFUSED' });
    assert.deepEqual(result, { status: 'error' });
  });
});
