import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { success } from '@/modules/auth/domain/auth';
import { safeAuthCall } from '@/modules/auth/presentation/safe-auth-call';

const user = { id: 'u1', name: 'Ana', email: 'ana@example.com', tenantId: 'setnar' };

describe('safeAuthCall', () => {
  it('passes a normal result through unchanged, without logging', async () => {
    const consoleError = mock.method(console, 'error', () => {});
    try {
      const result = await safeAuthCall(async () => success(user));
      assert.deepEqual(result, success(user));
      assert.equal(consoleError.mock.callCount(), 0);
    } finally {
      consoleError.mock.restore();
    }
  });

  it('catches the use case itself throwing and returns failure(unknown), logging the error', async () => {
    const consoleError = mock.method(console, 'error', () => {});
    try {
      const boom = new Error('use case exploded');
      const result = await safeAuthCall(async () => {
        // Simulates getAuthGateway() succeeding and the use case (e.g.
        // signIn) being the one that throws.
        await Promise.resolve();
        throw boom;
      });
      assert.deepEqual(result, { status: 'error', code: 'unknown' });
      assert.equal(consoleError.mock.callCount(), 1);
      assert.equal(consoleError.mock.calls[0]!.arguments[1], boom);
    } finally {
      consoleError.mock.restore();
    }
  });

  it('catches a failure from the first step inside the callback, not only from the use case call — proves getAuthGateway() throwing (not just signIn()) is covered', async () => {
    const consoleError = mock.method(console, 'error', () => {});
    try {
      const configError = new Error(
        "Your project's URL and Key are required to create a Supabase client!",
      );
      async function fakeGetAuthGateway(): Promise<never> {
        throw configError;
      }
      let useCaseWasReached = false;
      const result = await safeAuthCall(async () => {
        // Mirrors the real wiring — `async () => signIn(await getAuthGateway(), ...)`
        // — the first awaited step throws before the use case ever runs.
        await fakeGetAuthGateway();
        useCaseWasReached = true;
        return success(user);
      });
      assert.equal(useCaseWasReached, false, 'the use case must never run once the first step throws');
      assert.deepEqual(result, { status: 'error', code: 'unknown' });
      assert.equal(consoleError.mock.calls[0]!.arguments[1], configError);
    } finally {
      consoleError.mock.restore();
    }
  });

  it('re-throws a NEXT_REDIRECT flow-control error instead of converting it to a failure', async () => {
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;push;/app;307;',
    });

    await assert.rejects(
      () => safeAuthCall(async () => Promise.reject(redirectError)),
      (error: unknown) => error === redirectError,
    );
  });

  it('re-throws a NEXT_HTTP_ERROR_FALLBACK (notFound/forbidden/unauthorized) error instead of converting it to a failure', async () => {
    const notFoundError = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK'), {
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });

    await assert.rejects(
      () => safeAuthCall(async () => Promise.reject(notFoundError)),
      (error: unknown) => error === notFoundError,
    );
  });

  it('does not mistake an unrelated error carrying an unrelated digest field for Next flow control', async () => {
    const consoleError = mock.method(console, 'error', () => {});
    try {
      const weirdError = Object.assign(new Error('unrelated'), { digest: 'SOME_OTHER_CODE' });
      const result = await safeAuthCall(async () => Promise.reject(weirdError));
      assert.deepEqual(result, { status: 'error', code: 'unknown' });
    } finally {
      consoleError.mock.restore();
    }
  });
});
