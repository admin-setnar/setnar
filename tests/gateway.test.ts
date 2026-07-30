import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { signIn } from '@/modules/auth/application/sign-in';
import { signUp } from '@/modules/auth/application/sign-up';
import { signInWithProvider } from '@/modules/auth/application/sign-in-with-provider';
import type { AuthGateway } from '@/modules/auth/domain/auth-gateway';
import { MockAuthGateway } from '@/modules/auth/infrastructure/mock-auth-gateway';
import { signUpSchema } from '@/modules/auth/presentation/schemas/sign-up.schema';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';

const gateway = new MockAuthGateway();

describe('resolveTenant', () => {
  it('resolves a known hostname', async () => {
    const tenant = await resolveTenant('setnar.com');
    assert.equal(tenant.id, 'setnar');
  });

  it('ignores the port so local development matches', async () => {
    const tenant = await resolveTenant('LocalHost:3000');
    assert.equal(tenant.id, 'setnar');
  });

  it('falls back to the default tenant instead of failing the request', async () => {
    const tenant = await resolveTenant('preview-123.vercel.app');
    assert.equal(tenant.id, 'setnar');
  });

  it('never exposes a third-party brand name on the public page', async () => {
    const tenant = await resolveTenant('setnar.com');
    const rendered = JSON.stringify(tenant.marketing);
    assert.equal(tenant.vertical.displayName, undefined);
    assert.ok(!/igreen/i.test(rendered), 'marketing content must not name the vertical');
  });
});

describe('signIn', () => {
  it('authenticates a valid representative', async () => {
    const result = await signIn(gateway, {
      email: 'joao@exemplo.com',
      password: 'senha1234',
      rememberMe: true,
    });
    assert.equal(result.status, 'success');
  });

  it('reports invalid credentials without leaking which field was wrong', async () => {
    const result = await signIn(gateway, {
      email: 'senha-invalida@setnar.com',
      password: 'qualquer1',
      rememberMe: false,
    });
    assert.equal(result.status, 'error');
    assert.equal(result.status === 'error' && result.code, 'invalid_credentials');
  });

  it('surfaces rate limiting as its own code', async () => {
    const result = await signIn(gateway, {
      email: 'bloqueado@setnar.com',
      password: 'senha1234',
      rememberMe: false,
    });
    assert.equal(result.status === 'error' && result.code, 'rate_limited');
  });

  it('converts an unexpected gateway failure into a domain failure', async () => {
    const brokenGateway: AuthGateway = {
      signIn: () => Promise.reject(new Error('socket hang up')),
      signUp: () => Promise.reject(new Error('socket hang up')),
      signInWithProvider: () => Promise.reject(new Error('socket hang up')),
      signOut: () => Promise.reject(new Error('socket hang up')),
      requestPasswordReset: () => Promise.reject(new Error('socket hang up')),
      updatePassword: () => Promise.reject(new Error('socket hang up')),
    };
    const result = await signIn(brokenGateway, {
      email: 'joao@exemplo.com',
      password: 'senha1234',
      rememberMe: false,
    });
    assert.equal(result.status === 'error' && result.code, 'unknown');
  });
});

describe('signUp', () => {
  const base = { name: 'João Silva', email: 'novo@exemplo.com', password: 'senha1234' };

  it('creates an account when the terms are accepted', async () => {
    const result = await signUp(gateway, { ...base, acceptedTerms: true });
    assert.equal(result.status, 'success');
  });

  it('refuses to create an account without accepted terms, even if the form allowed it', async () => {
    const result = await signUp(gateway, { ...base, acceptedTerms: false });
    assert.equal(result.status, 'error');
  });

  it('rejects an already registered email', async () => {
    const result = await signUp(gateway, {
      ...base,
      email: 'existente@setnar.com',
      acceptedTerms: true,
    });
    assert.equal(result.status === 'error' && result.code, 'email_already_registered');
  });

  it('rejects a password that has no digits, independently of the form', async () => {
    const result = await signUp(gateway, {
      ...base,
      password: 'senhasenha',
      acceptedTerms: true,
    });
    assert.equal(result.status === 'error' && result.code, 'weak_password');
  });
});

describe('signInWithProvider', () => {
  it('reports the provider as unavailable while none is wired in', async () => {
    const result = await signInWithProvider(gateway, 'google');
    assert.equal(result.status === 'error' && result.code, 'provider_unavailable');
  });
});

describe('signUpSchema', () => {
  const valid = {
    name: 'João Silva',
    email: 'joao@exemplo.com',
    password: 'senha1234',
    confirmPassword: 'senha1234',
    acceptedTerms: true as const,
  };

  it('accepts a complete, consistent form', () => {
    assert.equal(signUpSchema.safeParse(valid).success, true);
  });

  it('reports mismatched passwords on the confirmation field', () => {
    const result = signUpSchema.safeParse({ ...valid, confirmPassword: 'outra1234' });
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0]?.path, ['confirmPassword']);
  });

  it('requires letters and digits in the password', () => {
    const result = signUpSchema.safeParse({
      ...valid,
      password: 'senhasenha',
      confirmPassword: 'senhasenha',
    });
    assert.equal(result.success, false);
  });

  it('blocks account creation when the terms are not accepted', () => {
    const result = signUpSchema.safeParse({ ...valid, acceptedTerms: false });
    assert.equal(result.success, false);
  });
});
