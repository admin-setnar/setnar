import type { Metadata } from 'next';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { getRepresentativeAccountRepository } from '@/modules/representatives/infrastructure/representative-account-repository-factory';
import { getRepresentativeCatalogRepository } from '@/modules/representatives/infrastructure/representative-catalog-repository-factory';
import { MarketingMaterialsPage } from '@/modules/marketing-materials/presentation/materials-page';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Materiais' };

function PageHeading() {
  return (
    <div className="space-y-2">
      <Text as="h1" variant="heading">Materiais de divulgação</Text>
      <Text as="p" variant="body">
        Post, Story e Poster já personalizados com seus dados — baixe e compartilhe.
      </Text>
    </div>
  );
}

export default async function MarketingPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const representative = await (await getRepresentativeAccountRepository()).findByProfileId(user.id);
  // Same fallback the sibling /app/contatos route uses for the same
  // precondition — a signed-in user who has not finished onboarding yet.
  if (!representative) {
    return (
      <div className="space-y-7">
        <PageHeading />
        <Card variant="raised" padding="lg" className="space-y-4">
          <Text as="h2" variant="title">Conclua primeiro seu perfil profissional</Text>
          <Text as="p" variant="body">
            Seus materiais de divulgação ficarão disponíveis depois que você concluir o onboarding e publicar uma página.
          </Text>
        </Card>
      </div>
    );
  }

  const catalogRepository = await getRepresentativeCatalogRepository();
  const [catalog, subscriptionActive] = await Promise.all([
    catalogRepository.listOwnCatalog(user.id),
    catalogRepository.isSubscriptionActive(representative.id),
  ]);

  return (
    <div className="space-y-7">
      <PageHeading />
      <MarketingMaterialsPage representative={representative} catalog={catalog} subscriptionActive={subscriptionActive} />
    </div>
  );
}
