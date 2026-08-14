'use client';

import { useState } from 'react';

import { FORMAT_DIMENSIONS, FORMAT_LABELS, getMaterialsForProduct, type MaterialFormat } from '@/modules/marketing-materials/registry';
import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import { MaterialPreview } from '@/modules/marketing-materials/presentation/material-preview';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

const FORMAT_ORDER: readonly MaterialFormat[] = ['post', 'story', 'poster'];
/** Fits comfortably in the `/app` shell's `max-w-5xl` column at every breakpoint; the export itself always uses the real dimensions (`MaterialPreview`), never this value. */
const PREVIEW_TARGET_WIDTH = 280;

/**
 * One product's three formats. Only the selected format's real-size node is
 * ever mounted (plan §30 — never render all 21 pieces at full resolution
 * at once): switching tabs unmounts the previous `MaterialPreview` entirely.
 */
export function ProductMaterialsCard({
  productLabel,
  productSlug,
  representativeSlug,
  materialProps,
}: {
  productLabel: string;
  productSlug: string;
  representativeSlug: string;
  materialProps: MarketingMaterialProps;
}) {
  // Resolved client-side, not passed down from the server: `Component` is a
  // function reference, which React Server Components cannot serialize
  // across the server→client boundary as a prop.
  const slots = getMaterialsForProduct(productSlug);
  const available = FORMAT_ORDER.filter((format) => slots.some((slot) => slot.format === format));
  // `materials-page.tsx` only renders this card when `slots` is non-empty,
  // so `available` is too — the `?? 'post'` is only to satisfy
  // `noUncheckedIndexedAccess`, never actually reached.
  const [activeFormat, setActiveFormat] = useState<MaterialFormat>(available[0] ?? 'post');
  const activeSlot = slots.find((slot) => slot.format === activeFormat);

  return (
    <Card variant="raised" padding="lg" className="space-y-4">
      <Text as="h2" variant="title">{productLabel}</Text>

      <div role="tablist" aria-label={`Formato do material de ${productLabel}`} className="flex flex-wrap gap-2">
        {available.map((format) => (
          <Button
            key={format}
            type="button"
            role="tab"
            aria-selected={format === activeFormat}
            variant={format === activeFormat ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveFormat(format)}
          >
            {FORMAT_LABELS[format]}
          </Button>
        ))}
      </div>

      {activeSlot ? (
        <MaterialPreview
          key={activeFormat}
          Component={activeSlot.Component}
          materialProps={materialProps}
          width={FORMAT_DIMENSIONS[activeFormat].width}
          height={FORMAT_DIMENSIONS[activeFormat].height}
          previewWidth={PREVIEW_TARGET_WIDTH}
          fileName={`${representativeSlug}-${activeSlot.productSlug}-${activeFormat}.png`}
        />
      ) : null}
    </Card>
  );
}
