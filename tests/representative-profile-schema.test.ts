import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { representativeProfileSchema } from '@/modules/representatives/presentation/schemas/representative-profile.schema';

const valid = {
  displayName: 'João Silva',
  phone: '(11) 98888-7777',
  city: 'São Paulo',
  authorizationId: 'ID-123456',
};

describe('representativeProfileSchema', () => {
  it('accepts a complete, valid form', () => {
    assert.equal(representativeProfileSchema.safeParse(valid).success, true);
  });

  it('rejects an omitted phone while keeping city optional', () => {
    const { phone, city, ...required } = valid;
    assert.equal(representativeProfileSchema.safeParse(required).success, false);
    assert.equal(representativeProfileSchema.safeParse({ ...required, phone }).success, true);
  });

  it('rejects an empty phone and accepts an empty city', () => {
    assert.equal(
      representativeProfileSchema.safeParse({ ...valid, phone: '', city: '' }).success,
      false,
    );
    assert.equal(representativeProfileSchema.safeParse({ ...valid, city: '' }).success, true);
  });

  describe('displayName', () => {
    it('rejects empty, single-word and overlong public names', () => {
      for (const displayName of ['', 'João', `${'A'.repeat(80)} B`]) {
        assert.equal(representativeProfileSchema.safeParse({ ...valid, displayName }).success, false);
      }
    });

    it('accepts a valid editable public name', () => {
      assert.equal(representativeProfileSchema.safeParse({ ...valid, displayName: 'João Comercial' }).success, true);
    });
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
    it('rejects an empty phone', () => {
      assert.equal(representativeProfileSchema.safeParse({ ...valid, phone: '' }).success, false);
    });

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
