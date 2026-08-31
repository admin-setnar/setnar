import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { getRepresentativeAccountRepository } from '@/modules/representatives/infrastructure/representative-account-repository-factory';
import { getRepresentativeCatalogRepository } from '@/modules/representatives/infrastructure/representative-catalog-repository-factory';
import { MarketingMaterialsPage } from '@/modules/marketing-materials/presentation/materials-page';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Biblioteca completa' };

function BackToDivulgacao() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/app/divulgacao">
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Voltar para Divulgação
      </Link>
    </Button>
  );
}

function PageHeading() {
  return (
    <div className="space-y-2">
      <Text as="h1" variant="heading">Materiais</Text>
      <Text as="p" variant="body">
        Biblioteca de Posts, Stories e Posters já com seus dados — baixe o que precisar e poste do seu jeito.
      </Text>
    </div>
  );
}

/**
 * `/app/divulgacao/biblioteca` — sub-rota de Divulgação (Alternativa C,
 * AUDIT_SET-101_ARQUITETURA_SEMANTICA.md §7; reverte SET-104/Alternativa A).
 * Movida de `/app/paginas/marketing` (que agora só redireciona para cá) sem
 * nenhuma mudança de comportamento: mesmo `MarketingMaterialsPage`, mesma
 * regra de disponibilidade. Existe como rota própria (não um passo dentro de
 * `DivulgacaoFlow`) porque `MarketingMaterialsPage` é um Server Component
 * assíncrono com fetch próprio — encaixá-la no wizard client-only duplicaria
 * dados já resolvidos pelo pai.
 */
export default async function DivulgacaoBibliotecaPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const representative = await (await getRepresentativeAccountRepository()).findByProfileId(user.id);
  // Same fallback the sibling /app/contatos route uses for the same
  // precondition — a signed-in user who has not finished onboarding yet.
  if (!representative) {
    return (
      <div className="space-y-7">
        <BackToDivulgacao />
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
      <BackToDivulgacao />
      <PageHeading />
      <MarketingMaterialsPage representative={representative} catalog={catalog} subscriptionActive={subscriptionActive} />
    </div>
  );
}
