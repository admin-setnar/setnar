import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { representativeProfileSchema } from '@/modules/representatives/presentation/schemas/representative-profile.schema';

const valid = {
  phone: '(11) 98888-7777',
  city: 'São Paulo',
  authorizationId: 'ID-123456',
};

describe('representativeProfileSchema', () => {
  it('accepts a complete, valid form', () => {
    assert.equal(representativeProfileSchema.safeParse(valid).success, true);
  });

  it('accepts phone and city omitted (optional fields)', () => {
    const { phone, city, ...required } = valid;
    assert.equal(representativeProfileSchema.safeParse(required).success, true);
  });

  it('accepts phone and city as empty strings', () => {
    assert.equal(
      representativeProfileSchema.safeParse({ ...valid, phone: '', city: '' }).success,
      true,
    );
  });

  describe('authorizationId', () => {
    it('rejects an empty value', () => {
      assert.equal(representativeProfileSchema.safeParse({ ...valid, authorizationId: '' }).success, false);
    });

    it('rejects a value over 100 characters', () => {
      assert.equal(
        representativeProfileSchema.safeParse({ ...valid, authorizationId: 'A'.repeat(101) }).success,
        false,
      );
    });

    it('accepts a value at exactly 100 characters', () => {
      assert.equal(
        representativeProfileSchema.safeParse({ ...valid, authorizationId: 'A'.repeat(100) }).success,
        true,
      );
    });
  });

  describe('phone', () => {
    it('rejects a phone that does not match the BR mask', () => {
      assert.equal(
        representativeProfileSchema.safeParse({ ...valid, phone: '11988887777' }).success,
        false,
      );
    });
  });

  describe('city', () => {
    it('rejects a city over 500 characters', () => {
      assert.equal(
        representativeProfileSchema.safeParse({ ...valid, city: 'A'.repeat(501) }).success,
        false,
      );
    });

    it('accepts a city at exactly 500 characters', () => {
      assert.equal(
        representativeProfileSchema.safeParse({ ...valid, city: 'A'.repeat(500) }).success,
        true,
      );
    });
  });
});
