import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import { safeClientAuthCall } from '@/modules/auth/presentation/safe-client-auth-call';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('auth modal resilience', () => {
  it('keeps the modal centered throughout its entrance and exit animation', () => {
    const tailwind = source('tailwind.config.ts');

    assert.match(tailwind, /translate\(-50%, calc\(-50% \+ 8px\)\) scale\(0\.98\)/);
    assert.match(tailwind, /translate\(-50%, -50%\) scale\(1\)/);
    assert.doesNotMatch(tailwind, /'content-in':[\s\S]*?translateY\(8px\)/);
  });

  it('opens each mobile auth view and closes the menu through the shared trigger callback', () => {
    const navbar = source('src/shared/layout/navbar.tsx');
    const trigger = source('src/modules/auth/presentation/auth-trigger-button.tsx');

    assert.match(navbar, /view="sign-in"[\s\S]*?onOpen=\{\(\) => setMenuOpen\(false\)\}/);
    assert.match(navbar, /view="sign-up"[\s\S]*?onOpen=\{\(\) => setMenuOpen\(false\)\}/);
    assert.doesNotMatch(navbar, /view="sign-(?:in|up)"[^>]*onClickCapture/);
    assert.match(trigger, /open\(view\);\s+onOpen\?\.\(\);/);
  });
});

describe('client auth transport boundary', () => {
  it('passes a resolved domain result through unchanged', async () => {
    const expected = { status: 'error' as const, code: 'invalid_credentials' as const };
    assert.equal(await safeClientAuthCall(async () => expected), expected);
  });

  it('maps a rejected network request to the generic retryable failure', async () => {
    const result = await safeClientAuthCall(async () => {
      throw new TypeError('Failed to fetch');
    });

    assert.deepEqual(result, { status: 'error', code: 'unknown' });
  });

  it('preserves Next navigation control flow instead of reporting a network failure', async () => {
    const redirect = Object.assign(new Error('redirect'), {
      digest: 'NEXT_REDIRECT;replace;/app/paginas;307;',
    });

    await assert.rejects(() => safeClientAuthCall(async () => Promise.reject(redirect)), redirect);
  });

  it('allows a later retry to succeed after a transport rejection', async () => {
    let connected = false;
    const submit = () =>
      safeClientAuthCall(async () => {
        if (!connected) throw new TypeError('Failed to fetch');
        return { status: 'pending_confirmation' as const, name: 'Ana', email: 'ana@example.com' };
      });

    assert.deepEqual(await submit(), { status: 'error', code: 'unknown' });
    connected = true;
    assert.deepEqual(await submit(), {
      status: 'pending_confirmation',
      name: 'Ana',
      email: 'ana@example.com',
    });
  });

  it('keeps the approved redirect and exposes clear transient signup feedback', () => {
    const action = source('src/modules/auth/presentation/actions.ts');
    const form = source('src/modules/auth/presentation/sign-up-form.tsx');

    assert.match(action, /redirect\(safeRedirectTarget\(next \?\? '\/app\/paginas'\)\)/);
    assert.match(form, /safeClientAuthCall\(\(\) => signUpAction\(values, next\)\)/);
    assert.match(form, /Criando sua conta\. Em seguida, você vai configurar suas páginas\./);
    assert.match(form, /isSubmitting \? 'Criando conta\.\.\.' : 'Criar conta'/);
  });
});

describe('auth modal dismissal after a server-redirected navigation', () => {
  it('watches the pathname and closes any open modal once it changes', () => {
    const hook = source('src/modules/auth/presentation/hooks/use-auth-modal.tsx');

    // A successful sign-in/sign-up never runs client code after the
    // `redirect()` in the Server Action, so nothing else calls `close()`.
    // AuthModalProvider lives in the root layout and survives the
    // navigation, so without this the modal would stay open on top of the
    // destination page (reproduced manually: /app/paginas rendered with the
    // sign-up dialog still mounted, data-state="open").
    assert.match(hook, /import \{ usePathname \} from 'next\/navigation';/);
    assert.match(hook, /const pathname = usePathname\(\);/);
    assert.match(hook, /\}, \[pathname, close\]\);/);
  });

  it('does not close a modal that was just opened on the current route', () => {
    const hook = source('src/modules/auth/presentation/hooks/use-auth-modal.tsx');

    // Opening a modal doesn't itself change the pathname, so the effect
    // must skip its first run — otherwise every `open()` would immediately
    // close the modal it just opened.
    assert.match(hook, /const isFirstRender = useRef\(true\);/);
    assert.match(
      hook,
      /if \(isFirstRender\.current\) \{\s*isFirstRender\.current = false;\s*return;\s*\}/,
    );
  });
});
