import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { redirect } from 'next/navigation';

import { safeOnboardingCall } from '@/modules/representatives/presentation/safe-onboarding-call';

describe('safeOnboardingCall', () => {
  it('passes a normal result through unchanged, without logging', async () => {
    const consoleError = mock.method(console, 'error', () => {});
    try {
      const result = await safeOnboardingCall(async () => ({
        status: 'created' as const,
        representativeId: 'rep-1',
      }));
      assert.deepEqual(result, { status: 'created', representativeId: 'rep-1' });
      assert.equal(consoleError.mock.callCount(), 0);
    } finally {
      consoleError.mock.restore();
    }
  });

  it('catches the use case itself throwing and returns { status: "error" }, logging the error', async () => {
    const consoleError = mock.method(console, 'error', () => {});
    try {
      const boom = new Error('use case exploded');
      const result = await safeOnboardingCall(async () => {
        // Simulates getRepresentativeOnboardingGateway() succeeding and the
        // use case (registerRepresentative) being the one that throws.
        await Promise.resolve();
        throw boom;
      });
      assert.deepEqual(result, { status: 'error' });
      assert.equal(consoleError.mock.callCount(), 1);
      assert.equal(consoleError.mock.calls[0]!.arguments[1], boom);
    } finally {
      consoleError.mock.restore();
    }
  });

  it('catches a failure from the first step inside the callback, not only from the use case call — proves getRepresentativeOnboardingGateway() throwing is covered', async () => {
    const consoleError = mock.method(console, 'error', () => {});
    try {
      const configError = new Error(
        "Your project's URL and Key are required to create a Supabase client!",
      );
      async function fakeGetGateway(): Promise<never> {
        throw configError;
      }
      let useCaseWasReached = false;
      const result = await safeOnboardingCall(async () => {
        await fakeGetGateway();
        useCaseWasReached = true;
        return { status: 'created' as const, representativeId: 'rep-1' };
      });
      assert.equal(useCaseWasReached, false, 'the use case must never run once the first step throws');
      assert.deepEqual(result, { status: 'error' });
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
      () => safeOnboardingCall(async () => Promise.reject(redirectError)),
      (error: unknown) => error === redirectError,
    );
  });

  it('re-throws a NEXT_HTTP_ERROR_FALLBACK (notFound/forbidden/unauthorized) error instead of converting it to a failure', async () => {
    const notFoundError = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK'), {
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });

    await assert.rejects(
      () => safeOnboardingCall(async () => Promise.reject(notFoundError)),
      (error: unknown) => error === notFoundError,
    );
  });

  it('end-to-end: a real next/navigation redirect() call inside the exact callback shape registerRepresentativeAction uses is re-thrown, not swallowed', async () => {
    // Since D3.B.5, registerRepresentativeAction calls redirect('/app') on
    // success inside this exact callback shape (await the use case, then
    // redirect on success) — this is the scenario that call relies on.
    let reachedPastRedirect = false;
    const call = safeOnboardingCall(async () => {
      await Promise.resolve({ status: 'created' as const, representativeId: 'rep-1' });
      redirect('/app');
      reachedPastRedirect = true;
      return { status: 'created' as const, representativeId: 'rep-1' };
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
      const result = await safeOnboardingCall(async () => Promise.reject(weirdError));
      assert.deepEqual(result, { status: 'error' });
    } finally {
      consoleError.mock.restore();
    }
  });
});
