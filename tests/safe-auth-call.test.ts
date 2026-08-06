import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { redirect } from 'next/navigation';

import { success } from '@/modules/auth/domain/auth';
import { safeAuthCall } from '@/modules/auth/presentation/safe-auth-call';

const user = { id: 'u1', name: 'Ana', email: 'ana@example.com', tenantId: 'setnar', phone: null };

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

  it('end-to-end: a real next/navigation redirect() call inside the exact callback shape Sprint B\'s actions use is re-thrown, not swallowed', async () => {
    // Not a synthetic digest this time — this calls the actual `redirect()`
    // every Server Action in actions.ts calls (e.g. signInAction on
    // success), inside the same "await the use case, then redirect on
    // success" callback shape those actions use. This is exactly the
    // scenario ADR-020's Emenda 3 was written to protect once Sprint B
    // added real redirect() calls to auth Server Actions.
    let reachedPastRedirect = false;
    const call = safeAuthCall(async () => {
      // The use case call itself is irrelevant here — this test is only
      // about what happens to redirect() once safeAuthCall wraps it, the
      // same shape as `signIn(...); if (success) redirect(...)`.
      await Promise.resolve(success({ id: 'u1', name: 'Ana', email: 'ana@example.com', tenantId: 'setnar', phone: null }));
      redirect('/app');
      reachedPastRedirect = true;
    });

    await assert.rejects(call, (error: unknown) => {
      const digest = (error as { digest?: unknown } | null)?.digest;
      return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT');
    });
    assert.equal(reachedPastRedirect, false, 'redirect() must throw, never return control to the caller');
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
