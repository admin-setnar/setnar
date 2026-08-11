import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toSafeLogError } from '@/shared/lib/safe-log-error';

describe('toSafeLogError', () => {
  it('extracts code and message from a PostgrestError-shaped object, dropping details/hint', () => {
    const postgrestError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "leads_pkey"',
      details: 'Key (phone)=(+5511999999999) already exists.',
      hint: null,
    };
    assert.deepEqual(toSafeLogError(postgrestError), {
      code: '23505',
      message: 'duplicate key value violates unique constraint "leads_pkey"',
    });
  });

  it('extracts only message from a plain Error, with no code', () => {
    const error = new Error('use case exploded');
    assert.deepEqual(toSafeLogError(error), { message: 'use case exploded' });
  });

  it('falls back to a generic message for a non-object, non-Error value', () => {
    assert.deepEqual(toSafeLogError('some string thrown'), { message: 'Unknown error' });
    assert.deepEqual(toSafeLogError(null), { message: 'Unknown error' });
    assert.deepEqual(toSafeLogError(undefined), { message: 'Unknown error' });
  });

  it('ignores a non-string code rather than passing it through', () => {
    const error = { message: 'weird shape', code: 42 };
    assert.deepEqual(toSafeLogError(error), { message: 'weird shape' });
  });
});
