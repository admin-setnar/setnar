import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { representativeOnboardingSchema } from '@/modules/representatives/presentation/schemas/representative-onboarding.schema';

const valid = {
  slug: 'joao-silva',
  displayName: 'João Silva',
  authorizationId: 'ID-123456',
  phone: '(11) 98888-7777',
  city: 'São Paulo',
};

describe('representativeOnboardingSchema', () => {
  it('accepts a complete, valid form', () => {
    assert.equal(representativeOnboardingSchema.safeParse(valid).success, true);
  });

  it('accepts phone and city omitted (optional fields)', () => {
    const { phone, city, ...required } = valid;
    assert.equal(representativeOnboardingSchema.safeParse(required).success, true);
  });

  it('accepts phone and city as empty strings', () => {
    assert.equal(
      representativeOnboardingSchema.safeParse({ ...valid, phone: '', city: '' }).success,
      true,
    );
  });

  describe('slug', () => {
    it('lowercases an uppercase value instead of rejecting it', () => {
      const result = representativeOnboardingSchema.safeParse({ ...valid, slug: 'Joao-Silva' });
      assert.equal(result.success, true);
      assert.equal(result.success && result.data.slug, 'joao-silva');
    });

    it('rejects an empty slug', () => {
      assert.equal(representativeOnboardingSchema.safeParse({ ...valid, slug: '' }).success, false);
    });

    it('rejects a slug with a leading hyphen', () => {
      assert.equal(representativeOnboardingSchema.safeParse({ ...valid, slug: '-joao' }).success, false);
    });

    it('rejects a slug with consecutive hyphens', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, slug: 'joao--silva' }).success,
        false,
      );
    });

    it('rejects a slug containing a dot', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, slug: 'joao.silva' }).success,
        false,
      );
    });

    it('rejects a slug containing whitespace inside the value', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, slug: 'joao silva' }).success,
        false,
      );
    });
  });

  describe('displayName', () => {
    it('rejects a single word', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, displayName: 'Joao' }).success,
        false,
      );
    });

    it('rejects an empty value', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, displayName: '' }).success,
        false,
      );
    });

    it('rejects a value over 80 characters', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, displayName: `${'A'.repeat(80)} B` })
          .success,
        false,
      );
    });
  });

  describe('authorizationId', () => {
    it('rejects an empty value', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, authorizationId: '' }).success,
        false,
      );
    });

    it('rejects a value over 100 characters', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, authorizationId: 'A'.repeat(101) }).success,
        false,
      );
    });

    it('accepts a value at exactly 100 characters', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, authorizationId: 'A'.repeat(100) }).success,
        true,
      );
    });
  });

  describe('phone', () => {
    it('rejects a phone that does not match the BR mask', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, phone: '11988887777' }).success,
        false,
      );
    });
  });

  describe('city', () => {
    it('rejects a city over 500 characters', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, city: 'A'.repeat(501) }).success,
        false,
      );
    });

    it('accepts a city at exactly 500 characters', () => {
      assert.equal(
        representativeOnboardingSchema.safeParse({ ...valid, city: 'A'.repeat(500) }).success,
        true,
      );
    });
  });
});
