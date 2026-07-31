import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { NextRequest } from 'next/server';

import { resetUpdateSessionWarningsForTests, updateSession } from '@/shared/lib/supabase/middleware';

/**
 * `updateSession` has no `import 'server-only'` (unlike `shared/lib/supabase/server.ts`),
 * so — unlike `getAuthGateway()`/`actions.ts` (see ADR-020's own note on why
 * those stay untestable) — it can be imported and driven directly here with
 * a real `NextRequest`, no Next.js runtime required. This exercises the
 * actual guard added for the audit's HTTP 500 finding (ADR-024), not a
 * re-implementation of it.
 *
 * Every case below calls `resetUpdateSessionWarningsForTests()` first: the
 * warn-once state in `middleware.ts` is module-level, on purpose (ADR-024 —
 * once per process, not once per request), which means it persists across
 * `it()` blocks in this same process unless reset.
 */
function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const saved = new Map<string, string | undefined>();
  for (const key of Object.keys(vars)) {
    saved.set(key, process.env[key]);
    const value = vars[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return run().finally(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

describe('updateSession (shared/lib/supabase/middleware)', () => {
  it('with both env vars missing: does not throw, returns 200, logs the "not set" warning exactly once', async () => {
    resetUpdateSessionWarningsForTests();
    await withEnv(
      { NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined },
      async () => {
        const errorMock = mock.method(console, 'error', () => {});
        try {
          const response = await updateSession(new NextRequest('http://localhost:3000/'));
          assert.equal(response.status, 200);
          assert.equal(errorMock.mock.callCount(), 1);
          const call = errorMock.mock.calls.at(0);
          assert.ok(call);
          assert.match(String(call.arguments[0]), /not set — session refresh is disabled/);
        } finally {
          errorMock.mock.restore();
        }
      },
    );
  });

  it('with only the key missing: still guards (falsy check covers a partial config too)', async () => {
    resetUpdateSessionWarningsForTests();
    await withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
      },
      async () => {
        const errorMock = mock.method(console, 'error', () => {});
        try {
          const response = await updateSession(new NextRequest('http://localhost:3000/'));
          assert.equal(response.status, 200);
          assert.equal(errorMock.mock.callCount(), 1);
        } finally {
          errorMock.mock.restore();
        }
      },
    );
  });

  it('with both env vars set to empty strings: treated as absent, not as a distinct "invalid" case', async () => {
    resetUpdateSessionWarningsForTests();
    await withEnv(
      { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' },
      async () => {
        const errorMock = mock.method(console, 'error', () => {});
        try {
          const response = await updateSession(new NextRequest('http://localhost:3000/'));
          assert.equal(response.status, 200);
          assert.equal(errorMock.mock.callCount(), 1);
          const call = errorMock.mock.calls.at(0);
          assert.ok(call);
          // Same message as the fully-absent case above — an empty string
          // (common on Vercel: a var set but left blank) is "missing", not
          // a new third category.
          assert.match(String(call.arguments[0]), /not set — session refresh is disabled/);
        } finally {
          errorMock.mock.restore();
        }
      },
    );
  });

  it('with a present but malformed URL: fails open (200), logs a distinct "set but invalid" warning, does not throw', async () => {
    resetUpdateSessionWarningsForTests();
    await withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-valid-url',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake0000000000000000000000',
      },
      async () => {
        const errorMock = mock.method(console, 'error', () => {});
        try {
          const response = await updateSession(new NextRequest('http://localhost:3000/'));
          assert.equal(response.status, 200);
          assert.equal(errorMock.mock.callCount(), 1);
          const call = errorMock.mock.calls.at(0);
          assert.ok(call);
          assert.match(String(call.arguments[0]), /set but invalid — session refresh is disabled/);
          // Must never be confusable with the "not set" message.
          assert.doesNotMatch(String(call.arguments[0]), /not set/);
        } finally {
          errorMock.mock.restore();
        }
      },
    );
  });

  it('logs at most once per process: a second call with the same missing config does not log again', async () => {
    resetUpdateSessionWarningsForTests();
    await withEnv(
      { NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined },
      async () => {
        const errorMock = mock.method(console, 'error', () => {});
        try {
          await updateSession(new NextRequest('http://localhost:3000/'));
          await updateSession(new NextRequest('http://localhost:3000/termos'));
          assert.equal(errorMock.mock.callCount(), 1);
        } finally {
          errorMock.mock.restore();
        }
      },
    );
  });

  it('the "missing" and "invalid" warnings are tracked independently: hitting one first does not suppress the other', async () => {
    resetUpdateSessionWarningsForTests();
    const errorMock = mock.method(console, 'error', () => {});
    try {
      await withEnv(
        { NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined },
        async () => {
          await updateSession(new NextRequest('http://localhost:3000/'));
        },
      );
      await withEnv(
        {
          NEXT_PUBLIC_SUPABASE_URL: 'not-a-valid-url',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake0000000000000000000000',
        },
        async () => {
          await updateSession(new NextRequest('http://localhost:3000/'));
        },
      );
      assert.equal(errorMock.mock.callCount(), 2);
      const [first, second] = errorMock.mock.calls;
      assert.ok(first);
      assert.ok(second);
      assert.match(String(first.arguments[0]), /not set/);
      assert.match(String(second.arguments[0]), /set but invalid/);
    } finally {
      errorMock.mock.restore();
    }
  });
});
