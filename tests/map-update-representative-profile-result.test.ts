import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapUpdateRepresentativeProfileResult } from '@/modules/representatives/infrastructure/map-update-representative-profile-result';

describe('mapUpdateRepresentativeProfileResult', () => {
  it('maps an updated row to status "updated"', () => {
    const result = mapUpdateRepresentativeProfileResult([{ status: 'updated' }], null);
    assert.deepEqual(result, { status: 'updated' });
  });

  for (const reason of [
    'representative_not_found',
    'license_id_invalid',
    'phone_invalid',
    'city_invalid',
  ] as const) {
    it(`maps the "${reason}" status to a typed rejection with that reason`, () => {
      const result = mapUpdateRepresentativeProfileResult([{ status: reason }], null);
      assert.deepEqual(result, { status: 'rejected', reason });
    });
  }

  it('maps an unrecognised status string to "error" instead of guessing', () => {
    const result = mapUpdateRepresentativeProfileResult(
      [{ status: 'some_future_status_this_mapper_does_not_know_about' }],
      null,
    );
    assert.deepEqual(result, { status: 'error' });
  });

  it('does not accept another RPC\'s own success status as its own', () => {
    // 'activated' is activate_product's success value, 'created' is
    // register_representative's — leaking either through here would mean
    // these mappers are interchangeable, which they are not.
    for (const foreignStatus of ['activated', 'created']) {
      const result = mapUpdateRepresentativeProfileResult([{ status: foreignStatus }], null);
      assert.deepEqual(result, { status: 'error' });
    }
  });

  it('maps a null data array with no error to "error"', () => {
    assert.deepEqual(mapUpdateRepresentativeProfileResult(null, null), { status: 'error' });
  });

  it('maps an empty data array with no error to "error"', () => {
    assert.deepEqual(mapUpdateRepresentativeProfileResult([], null), { status: 'error' });
  });

  it('maps a non-null error to "error", regardless of data', () => {
    const result = mapUpdateRepresentativeProfileResult([{ status: 'updated' }], {
      message: 'network error',
    });
    assert.deepEqual(result, { status: 'error' });
  });

  it('maps a non-null error with null data to "error"', () => {
    const result = mapUpdateRepresentativeProfileResult(null, {
      message: 'connection refused',
      code: 'ECONNREFUSED',
    });
    assert.deepEqual(result, { status: 'error' });
  });
});
