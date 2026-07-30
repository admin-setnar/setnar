import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isDuplicateSignUp } from '@/modules/auth/infrastructure/is-duplicate-signup';

describe('isDuplicateSignUp', () => {
  it('treats an empty identities array as an existing account', () => {
    assert.equal(isDuplicateSignUp({ identities: [] }), true);
  });

  it('treats a missing identities field as an existing account', () => {
    assert.equal(isDuplicateSignUp({}), true);
  });

  it('treats a populated identities array as a newly created account', () => {
    assert.equal(isDuplicateSignUp({ identities: [{ id: 'identity-1' }] }), false);
  });
});
