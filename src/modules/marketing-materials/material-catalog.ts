/**
 * Pure catalog metadata — product×format pairs, dimensions, labels — with
 * zero import of the 21 React pieces themselves. Deliberately separate from
 * `registry.ts` (which does import them, transitively pulling in each
 * piece's `./fonts` CSS import): `node --test` has no CSS loader, so any
 * test importing a module that reaches a `.css` import crashes at require
 * time (confirmed — `@fontsource/archivo-black/index.css` is not valid JS).
 * The existing commercial-pages tests avoid this by never importing the
 * real components either (`tests/commercial-page-templates.test.ts` reads
 * source text instead). This file lets business rules that only need to
 * know *which* products have materials — not the components — stay
 * testable without that constraint.
 */
export type MaterialFormat = 'post' | 'story' | 'poster';

export const FORMAT_DIMENSIONS: Record<MaterialFormat, { width: number; height: number }> = {
  post: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  poster: { width: 794, height: 1123 },
};

export const FORMAT_LABELS: Record<MaterialFormat, string> = {
  post: 'Post para redes sociais',
  story: 'Story / Status',
  poster: 'Poster com QR Code',
};

const FORMATS: readonly MaterialFormat[] = ['post', 'story', 'poster'];

/** The 7 product slugs the 21-piece library covers — one entry, not one per format (`hasMaterialsForProduct` derives the rest). */
export const PRODUCT_SLUGS_WITH_MATERIALS: readonly string[] = [
  'conexao-green',
  'conexao-club',
  'conexao-livre',
  'conexao-placas',
  'conexao-solar',
  'green-seguros',
  'telecom',
];

export function hasMaterialsForProduct(productSlug: string): boolean {
  return PRODUCT_SLUGS_WITH_MATERIALS.includes(productSlug);
}

export function formatsForProduct(productSlug: string): readonly MaterialFormat[] {
  return hasMaterialsForProduct(productSlug) ? FORMATS : [];
}
