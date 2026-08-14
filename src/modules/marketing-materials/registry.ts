import type { ComponentType } from 'react';

import { FORMAT_DIMENSIONS, FORMAT_LABELS, type MaterialFormat } from '@/modules/marketing-materials/material-catalog';
import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import { ConexaoGreenPost } from '@/modules/marketing-materials/presentation/conexao-green/conexao-green-post';
import { ConexaoGreenStory } from '@/modules/marketing-materials/presentation/conexao-green/conexao-green-story';
import { ConexaoGreenPoster } from '@/modules/marketing-materials/presentation/conexao-green/conexao-green-poster';
import { ConexaoClubPost } from '@/modules/marketing-materials/presentation/conexao-club/conexao-club-post';
import { ConexaoClubStory } from '@/modules/marketing-materials/presentation/conexao-club/conexao-club-story';
import { ConexaoClubPoster } from '@/modules/marketing-materials/presentation/conexao-club/conexao-club-poster';
import { ConexaoLivrePost } from '@/modules/marketing-materials/presentation/conexao-livre/conexao-livre-post';
import { ConexaoLivreStory } from '@/modules/marketing-materials/presentation/conexao-livre/conexao-livre-story';
import { ConexaoLivrePoster } from '@/modules/marketing-materials/presentation/conexao-livre/conexao-livre-poster';
import { ConexaoPlacasPost } from '@/modules/marketing-materials/presentation/conexao-placas/conexao-placas-post';
import { ConexaoPlacasStory } from '@/modules/marketing-materials/presentation/conexao-placas/conexao-placas-story';
import { ConexaoPlacasPoster } from '@/modules/marketing-materials/presentation/conexao-placas/conexao-placas-poster';
import { ConexaoSolarPost } from '@/modules/marketing-materials/presentation/conexao-solar/conexao-solar-post';
import { ConexaoSolarStory } from '@/modules/marketing-materials/presentation/conexao-solar/conexao-solar-story';
import { ConexaoSolarPoster } from '@/modules/marketing-materials/presentation/conexao-solar/conexao-solar-poster';
import { GreenSegurosPost } from '@/modules/marketing-materials/presentation/green-seguros/green-seguros-post';
import { GreenSegurosStory } from '@/modules/marketing-materials/presentation/green-seguros/green-seguros-story';
import { GreenSegurosPoster } from '@/modules/marketing-materials/presentation/green-seguros/green-seguros-poster';
import { TelecomPost } from '@/modules/marketing-materials/presentation/telecom/telecom-post';
import { TelecomStory } from '@/modules/marketing-materials/presentation/telecom/telecom-story';
import { TelecomPoster } from '@/modules/marketing-materials/presentation/telecom/telecom-poster';

export type { MaterialFormat };
export { FORMAT_DIMENSIONS, FORMAT_LABELS };

export interface MaterialSlot {
  /** Slug do produto (`RepresentativeProduct.slug`) — nunca aparece na arte, só uso interno (lookup, rota, arquivo). */
  readonly productSlug: string;
  readonly format: MaterialFormat;
  readonly Component: ComponentType<MarketingMaterialProps>;
}

/**
 * Catálogo dos 21 materiais (7 produtos × 3 formatos), portados verbatim de
 * `templates/marketing-materials/` (`MARKETING_MATERIALS_PLAN.md` §5). Mesma
 * forma do registry de referência (produto × formato → componente).
 */
export const MATERIALS_REGISTRY: readonly MaterialSlot[] = [
  { productSlug: 'conexao-green', format: 'post', Component: ConexaoGreenPost },
  { productSlug: 'conexao-green', format: 'story', Component: ConexaoGreenStory },
  { productSlug: 'conexao-green', format: 'poster', Component: ConexaoGreenPoster },

  { productSlug: 'conexao-club', format: 'post', Component: ConexaoClubPost },
  { productSlug: 'conexao-club', format: 'story', Component: ConexaoClubStory },
  { productSlug: 'conexao-club', format: 'poster', Component: ConexaoClubPoster },

  { productSlug: 'conexao-livre', format: 'post', Component: ConexaoLivrePost },
  { productSlug: 'conexao-livre', format: 'story', Component: ConexaoLivreStory },
  { productSlug: 'conexao-livre', format: 'poster', Component: ConexaoLivrePoster },

  { productSlug: 'conexao-placas', format: 'post', Component: ConexaoPlacasPost },
  { productSlug: 'conexao-placas', format: 'story', Component: ConexaoPlacasStory },
  { productSlug: 'conexao-placas', format: 'poster', Component: ConexaoPlacasPoster },

  { productSlug: 'conexao-solar', format: 'post', Component: ConexaoSolarPost },
  { productSlug: 'conexao-solar', format: 'story', Component: ConexaoSolarStory },
  { productSlug: 'conexao-solar', format: 'poster', Component: ConexaoSolarPoster },

  { productSlug: 'green-seguros', format: 'post', Component: GreenSegurosPost },
  { productSlug: 'green-seguros', format: 'story', Component: GreenSegurosStory },
  { productSlug: 'green-seguros', format: 'poster', Component: GreenSegurosPoster },

  { productSlug: 'telecom', format: 'post', Component: TelecomPost },
  { productSlug: 'telecom', format: 'story', Component: TelecomStory },
  { productSlug: 'telecom', format: 'poster', Component: TelecomPoster },
];

/** Every material for a given product, in the fixed post→story→poster order the UI always presents them in. */
export function getMaterialsForProduct(productSlug: string): readonly MaterialSlot[] {
  return MATERIALS_REGISTRY.filter((slot) => slot.productSlug === productSlug);
}
