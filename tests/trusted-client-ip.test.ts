import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getTrustedClientIp } from '@/shared/lib/trusted-client-ip';

function headers(values: Record<string, string>): Pick<Headers, 'get'> {
  return { get: (name) => values[name.toLowerCase()] ?? null };
}

describe('getTrustedClientIp', () => {
  it('prefers the Vercel-specific header in a Vercel runtime', () => {
    assert.equal(
      getTrustedClientIp(
        headers({ 'x-vercel-forwarded-for': '203.0.113.10', 'x-forwarded-for': '198.51.100.20' }),
        true,
      ),
      '203.0.113.10',
    );
  });

  it('accepts Vercel x-forwarded-for as a fallback', () => {
    assert.equal(getTrustedClientIp(headers({ 'x-forwarded-for': '2001:db8::1' }), true), '2001:db8::1');
  });

  it('rejects the same client-controlled headers outside Vercel', () => {
    assert.equal(
      getTrustedClientIp(headers({ 'x-vercel-forwarded-for': '203.0.113.10', 'x-forwarded-for': '198.51.100.20' }), false),
      null,
    );
  });

  it('returns null for absent, empty or malformed values', () => {
    assert.equal(getTrustedClientIp(headers({}), true), null);
    assert.equal(getTrustedClientIp(headers({ 'x-vercel-forwarded-for': '' }), true), null);
    assert.equal(getTrustedClientIp(headers({ 'x-vercel-forwarded-for': 'attacker-chosen' }), true), null);
  });
});
