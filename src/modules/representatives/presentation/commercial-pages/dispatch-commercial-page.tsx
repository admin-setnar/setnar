import { ConexaoClubPage } from '@/modules/representatives/presentation/commercial-pages/conexao-club/conexao-club-page';
import { ConexaoGreenPage } from '@/modules/representatives/presentation/commercial-pages/conexao-green/conexao-green-page';
import { ConexaoLivrePage } from '@/modules/representatives/presentation/commercial-pages/conexao-livre/conexao-livre-page';
import { ConexaoPlacasPage } from '@/modules/representatives/presentation/commercial-pages/conexao-placas/conexao-placas-page';
import { ConexaoSolarPage } from '@/modules/representatives/presentation/commercial-pages/conexao-solar/conexao-solar-page';
import { GreenSegurosPage } from '@/modules/representatives/presentation/commercial-pages/green-seguros/green-seguros-page';
import { TelecomPage } from '@/modules/representatives/presentation/commercial-pages/telecom/telecom-page';
import type { OriginId } from '@/modules/analytics/domain/origin';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';

/** ADR-089: the only shared composition point. Both public and preview routes
 * use this exhaustive product router, while each product owns its page tree. */
export function DispatchCommercialPage({
  representative,
  product,
  productSlug,
  leadFormDisabled = false,
  origin,
}: {
  representative: Representative;
  product: RepresentativeProduct;
  productSlug: string;
  leadFormDisabled?: boolean;
  origin: OriginId | null;
}) {
  const props = { representative, product, productSlug, leadFormDisabled, origin };
  switch (product.slug) {
    case 'conexao-club':
      return <ConexaoClubPage {...props} />;
    case 'conexao-green': return <ConexaoGreenPage {...props} />;
    case 'conexao-livre': return <ConexaoLivrePage {...props} />;
    case 'conexao-placas': return <ConexaoPlacasPage {...props} />;
    case 'conexao-solar': return <ConexaoSolarPage {...props} />;
    case 'green-seguros': return <GreenSegurosPage {...props} />;
    case 'telecom': return <TelecomPage {...props} />;
    default: return null;
  }
}
