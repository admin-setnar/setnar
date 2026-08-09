import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { verifyAsaasWebhookToken } from '@/modules/billing/presentation/verify-asaas-webhook-token';

const EXPECTED = 'a'.repeat(40);

describe('verifyAsaasWebhookToken', () => {
  it('accepts the exact expected token', () => {
    assert.equal(verifyAsaasWebhookToken(EXPECTED, EXPECTED), true);
  });

  it('rejects a wrong token of the same length', () => {
    assert.equal(verifyAsaasWebhookToken('b'.repeat(40), EXPECTED), false);
  });

  it('rejects a token that differs only in one character', () => {
    const almost = `${'a'.repeat(39)}b`;
    assert.equal(verifyAsaasWebhookToken(almost, EXPECTED), false);
  });

  it('rejects a shorter or longer token without throwing', () => {
    assert.equal(verifyAsaasWebhookToken(EXPECTED.slice(0, -1), EXPECTED), false);
    assert.equal(verifyAsaasWebhookToken(`${EXPECTED}x`, EXPECTED), false);
  });

  it('rejects a null (missing header) token', () => {
    assert.equal(verifyAsaasWebhookToken(null, EXPECTED), false);
  });

  it('rejects an empty string token', () => {
    assert.equal(verifyAsaasWebhookToken('', EXPECTED), false);
  });
});
