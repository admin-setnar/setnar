import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { registerRepresentative } from '@/modules/representatives/application/register-representative';
import type {
  RegisterRepresentativeInput,
  RegisterRepresentativeResult,
  RepresentativeOnboardingGateway,
} from '@/modules/representatives/domain/representative-onboarding-gateway';

const input: RegisterRepresentativeInput = {
  slug: 'joao-silva',
  displayName: 'João Silva',
  authorizationId: 'ID-123456',
  phone: null,
  city: null,
};

function fakeGateway(result: RegisterRepresentativeResult): RepresentativeOnboardingGateway {
  return { register: () => Promise.resolve(result) };
}

describe('registerRepresentative', () => {
  it('passes a created result through unchanged', async () => {
    const gateway = fakeGateway({ status: 'created', representativeId: 'rep-1' });
    const result = await registerRepresentative(gateway, input);
    assert.deepEqual(result, { status: 'created', representativeId: 'rep-1' });
  });

  it('passes a rejected result through unchanged', async () => {
    const gateway = fakeGateway({ status: 'rejected', reason: 'slug_taken' });
    const result = await registerRepresentative(gateway, input);
    assert.deepEqual(result, { status: 'rejected', reason: 'slug_taken' });
  });

  it('passes a gateway-reported error through unchanged', async () => {
    const gateway = fakeGateway({ status: 'error' });
    const result = await registerRepresentative(gateway, input);
    assert.deepEqual(result, { status: 'error' });
  });

  it('converts an unexpected gateway exception into { status: "error" }', async () => {
    const brokenGateway: RepresentativeOnboardingGateway = {
      register: () => Promise.reject(new Error('socket hang up')),
    };
    const result = await registerRepresentative(brokenGateway, input);
    assert.deepEqual(result, { status: 'error' });
  });
});
