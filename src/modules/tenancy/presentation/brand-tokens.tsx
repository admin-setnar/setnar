import type { BrandTokens } from '@/modules/tenancy/domain/tenant';

/**
 * Applies the tenant's design tokens.
 *
 * Rendered on the server into <head>, so branding is correct on first paint —
 * no flash of the default palette. This is what makes white-labelling a data
 * change rather than a build.
 *
 * `scope`, when given, emits `[data-vertical="${scope}"]{...}` instead of
 * `:root{...}` — the tenant's own tokens stay global, but a vertical's
 * tokens (e.g. iGreen's Commercial Pages, CP9) only repaint the subtree
 * whose root element carries a matching `data-vertical` attribute. Any
 * token this rule doesn't redeclare (e.g. `--palette-700`) keeps inheriting
 * from `:root` through normal custom-property cascade — there is nothing
 * else to wire up for that.
 */
export function BrandTokensStyle({ tokens, scope }: { tokens: BrandTokens; scope?: string }) {
  const declarations = Object.entries(tokens)
    .map(([token, value]) => `${token}:${value};`)
    .join('');

  if (!declarations) return null;

  const selector = scope ? `[data-vertical="${scope}"]` : ':root';
  return <style>{`${selector}{${declarations}}`}</style>;
}
