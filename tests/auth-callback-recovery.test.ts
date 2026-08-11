import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

/**
 * `app/auth/callback/route.ts` imports `createClient` from
 * `shared/lib/supabase/server.ts`, which has `import 'server-only'` —
 * importing/executing it directly throws unconditionally in the plain
 * `tsx --test` process this suite runs under (same constraint documented
 * for `actions.ts`, ADR-020). Same workaround as
 * `tests/auth-ux-resilience.test.ts` (SET-57): assert against the source
 * text instead of invoking the handler.
 */
function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('password-reset callback: cross-device recovery (SET-40/ADR-081)', () => {
  it('verifies a token_hash recovery link via verifyOtp, without requiring the same browser/device', () => {
    const route = source('src/app/auth/callback/route.ts');

    assert.match(route, /const tokenHash = searchParams\.get\('token_hash'\);/);
    assert.match(route, /const type = searchParams\.get\('type'\);/);
    assert.match(
      route,
      /if \(tokenHash && type === 'recovery'\) \{\s*const \{ error \} = await supabase\.auth\.verifyOtp\(\{ type: 'recovery', token_hash: tokenHash \}\);/,
    );
  });

  it('keeps the legacy PKCE code-exchange branch as a fallback', () => {
    const route = source('src/app/auth/callback/route.ts');

    assert.match(route, /\} else if \(code\) \{/);
    assert.match(route, /await supabase\.auth\.exchangeCodeForSession\(code\);/);
  });

  it('signals a failed callback instead of silently redirecting to an empty form', () => {
    const route = source('src/app/auth/callback/route.ts');

    assert.match(
      route,
      /NextResponse\.redirect\(`\$\{origin\}\/esqueci-senha\?error=reset_link_expired`/,
    );
    // The old unconditional, unsignalled redirect must be gone.
    assert.doesNotMatch(route, /NextResponse\.redirect\(`\$\{origin\}\/esqueci-senha`,/);
  });

  it('still validates `next` through safeRedirectTarget before redirecting on success', () => {
    const route = source('src/app/auth/callback/route.ts');

    assert.match(route, /const next = safeRedirectTarget\(searchParams\.get\('next'\)\);/);
    assert.match(route, /NextResponse\.redirect\(`\$\{origin\}\$\{next\}`/);
  });
});

describe('/esqueci-senha surfaces the reset_link_expired error (SET-40)', () => {
  it('reads ?error= and only trusts the literal reset_link_expired value', () => {
    const page = source('src/app/esqueci-senha/page.tsx');

    assert.match(page, /searchParams: Promise<\{ error\?: string \}>/);
    assert.match(
      page,
      /const initialFailureCode: AuthErrorCode \| null = error === 'reset_link_expired' \? error : null;/,
    );
    assert.match(page, /<ForgotPasswordForm initialFailureCode=\{initialFailureCode\} \/>/);
  });

  it('lets ForgotPasswordForm start with a failure already set', () => {
    const form = source('src/modules/auth/presentation/forgot-password-form.tsx');

    assert.match(form, /initialFailureCode\?: AuthErrorCode \| null;/);
    assert.match(
      form,
      /useState<AuthErrorCode \| null>\(initialFailureCode\);/,
    );
  });
});
