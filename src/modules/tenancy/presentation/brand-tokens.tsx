import type { BrandTokens } from '@/modules/tenancy/domain/tenant';

/**
 * Applies the tenant's design tokens.
 *
 * Rendered on the server into <head>, so branding is correct on first paint —
 * no flash of the default palette. This is what makes white-labelling a data
 * change rather than a build.
 */
export function BrandTokensStyle({ tokens }: { tokens: BrandTokens }) {
  const declarations = Object.entries(tokens)
    .map(([token, value]) => `${token}:${value};`)
    .join('');

  if (!declarations) return null;

  return <style>{`:root{${declarations}}`}</style>;
}
