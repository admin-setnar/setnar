/** Where sign-in/sign-up send the user when no (valid) `?next=` was given. */
export const DEFAULT_REDIRECT_TARGET = '/app';

/**
 * Validates a `?next=` value before it is ever passed to `redirect()`.
 *
 * Without this, `?next=https://site-malicioso.com` (or the protocol-relative
 * `?next=//site-malicioso.com`, which browsers resolve against the current
 * protocol) turns Setnar's own trusted domain into an open redirect —
 * phishing-ready, since the link itself points at setnar.com and only the
 * final hop leaves it. Only a same-origin, relative path is accepted;
 * anything else falls back to `DEFAULT_REDIRECT_TARGET`.
 *
 * The backslash check is defense in depth beyond the two required cases
 * above: some URL parsers historically normalise a leading `/\` the same as
 * `//`, which would otherwise slip past a check that only looks for a
 * literal `//` prefix.
 */
export function safeRedirectTarget(next: string | null | undefined): string {
  if (!next) return DEFAULT_REDIRECT_TARGET;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return DEFAULT_REDIRECT_TARGET;
  }
  return next;
}
