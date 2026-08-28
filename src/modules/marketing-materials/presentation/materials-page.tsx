import Link from 'next/link';

import type { Representative } from '@/modules/representatives/domain/representative';
import type { RepresentativeCatalogEntry } from '@/modules/representatives/domain/representative-catalog-repository';
import { isRepresentativeProfileComplete } from '@/modules/representatives/domain/representative-rules';
import { buildMarketingMaterialPropsForOrigin } from '@/modules/marketing-materials/material-props';
import { selectAvailableProductsWithMaterials } from '@/modules/marketing-materials/select-available-materials';
import { ProductMaterialsCard } from '@/modules/marketing-materials/presentation/product-materials-card';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

/**
 * `/app/paginas/marketing` (SET-65). Server Component: resolves which
 * products are real materials for, in real time, from the same source of
 * truth `/app/paginas` itself uses — never a bespoke `isActive` flag (plan
 * §2.6). `representative` is always resolved by the caller from
 * `auth.uid()` (never a client-supplied id), same tenancy guarantee every
 * other `/app` route already has.
 *
 * SET-105 (AUDIT_SET-101 §8) — the QR Code embedded in each poster is a
 * known distribution mechanism, so it carries `?src=qrcode`
 * (`buildMarketingMaterialPropsForOrigin`) instead of the bare canonical
 * link `buildMarketingMaterialPropsWithQrCode` used to produce.
 */
export async function MarketingMaterialsPage({
  representative,
  catalog,
  subscriptionActive,
}: {
  representative: Representative;
  catalog: readonly RepresentativeCatalogEntry[];
  subscriptionActive: boolean;
}) {
  const profileComplete = isRepresentativeProfileComplete(representative);
  const productsWithMaterials = selectAvailableProductsWithMaterials(catalog, subscriptionActive, profileComplete);

  if (productsWithMaterials.length === 0) {
    return (
      <Card variant="outlined" padding="lg" className="space-y-2">
        <Text as="h2" variant="title">Nenhum material disponível ainda</Text>
        <Text as="p" variant="body">
          Seus materiais de divulgação aparecem aqui assim que você tiver uma página publicada. Publique um produto em{' '}
          <Link href="/app/paginas" className="text-brand underline underline-offset-2">Páginas</Link> para começar.
        </Text>
      </Card>
    );
  }

  const cards = await Promise.all(
    productsWithMaterials.map(async (entry) => ({
      key: entry.product.id,
      productLabel: entry.product.name,
      productSlug: entry.product.slug,
      materialProps: await buildMarketingMaterialPropsForOrigin(representative, entry.product, 'qrcode'),
    })),
  );

  return (
    <div className="space-y-6">
      {cards.map((card) => (
        // `MaterialSlot.Component` is a function reference — cannot cross the
        // server→client boundary as a prop (RSC serialization). Only
        // `productSlug` (a string) is passed; `ProductMaterialsCard` resolves
        // the registry itself, client-side, where the component references
        // already live in the client bundle via `MaterialPreview`.
        <ProductMaterialsCard
          key={card.key}
          productLabel={card.productLabel}
          productSlug={card.productSlug}
          representativeSlug={representative.slug}
          materialProps={card.materialProps}
        />
      ))}
    </div>
  );
}
