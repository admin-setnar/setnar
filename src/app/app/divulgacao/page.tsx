import type { Metadata } from 'next';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { isRepresentativeProfileComplete } from '@/modules/representatives/domain/representative-rules';
import { getRepresentativeAccountRepository } from '@/modules/representatives/infrastructure/representative-account-repository-factory';
import { getRepresentativeCatalogRepository } from '@/modules/representatives/infrastructure/representative-catalog-repository-factory';
import { selectAvailableProductsWithMaterials } from '@/modules/marketing-materials/select-available-materials';
import { DivulgacaoFlow } from '@/modules/marketing-materials/presentation/divulgacao-flow';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Divulgação' };

function PageHeading() {
  return (
    <div className="space-y-2">
      <Text as="h1" variant="heading">Divulgação</Text>
      <Text as="p" variant="body">
        Escolha o produto e o canal — o material, o texto e o link já saem prontos.
      </Text>
    </div>
  );
}

/**
 * SET-84 D4 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md) — `/app/divulgacao`,
 * rota nova e independente de `/app/paginas/marketing` (que fica como está
 * nesta rodada). Mesma resolução de dados de `MarketingMaterialsPage`
 * (SET-65) — a mesma regra canônica de disponibilidade, o mesmo catálogo —
 * porque a decisão do plano foi: nova superfície de PRODUTO, não nova
 * arquitetura de domínio. `DivulgacaoFlow` é só composição/apresentação por
 * cima de módulos existentes (`marketing-materials`, `analytics/domain/origin`);
 * nenhum `src/modules/divulgacao/*` nasce aqui.
 */
export default async function DivulgacaoPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const representative = await (await getRepresentativeAccountRepository()).findByProfileId(user.id);
  if (!representative) {
    return (
      <div className="space-y-7">
        <PageHeading />
        <Card variant="raised" padding="lg" className="space-y-4">
          <Text as="h2" variant="title">Conclua primeiro seu perfil profissional</Text>
          <Text as="p" variant="body">
            A Divulgação fica disponível depois que você concluir o onboarding e publicar uma página.
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

  const profileComplete = isRepresentativeProfileComplete(representative);
  const productsWithMaterials = selectAvailableProductsWithMaterials(catalog, subscriptionActive, profileComplete);

  if (productsWithMaterials.length === 0) {
    return (
      <div className="space-y-7">
        <PageHeading />
        <Card variant="outlined" padding="lg" className="space-y-2">
          <Text as="h2" variant="title">Nenhum produto disponível ainda</Text>
          <Text as="p" variant="body">
            A Divulgação aparece aqui assim que você tiver uma página publicada.
          </Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <PageHeading />
      <DivulgacaoFlow representative={representative} products={productsWithMaterials.map((entry) => entry.product)} />
    </div>
  );
}
