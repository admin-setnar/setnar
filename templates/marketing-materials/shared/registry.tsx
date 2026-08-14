import type { ComponentType } from 'react';
import type { MarketingMaterialProps } from './types';
import { ConexaoGreenPost } from '../conexao-green/conexao-green-post';
import { ConexaoGreenStory } from '../conexao-green/conexao-green-story';
import { ConexaoGreenPoster } from '../conexao-green/conexao-green-poster';
import { ConexaoClubPost } from '../conexao-club/conexao-club-post';
import { ConexaoClubStory } from '../conexao-club/conexao-club-story';
import { ConexaoClubPoster } from '../conexao-club/conexao-club-poster';
import { ConexaoLivrePost } from '../conexao-livre/conexao-livre-post';
import { ConexaoLivreStory } from '../conexao-livre/conexao-livre-story';
import { ConexaoLivrePoster } from '../conexao-livre/conexao-livre-poster';
import { ConexaoPlacasPost } from '../conexao-placas/conexao-placas-post';
import { ConexaoPlacasStory } from '../conexao-placas/conexao-placas-story';
import { ConexaoPlacasPoster } from '../conexao-placas/conexao-placas-poster';
import { ConexaoSolarPost } from '../conexao-solar/conexao-solar-post';
import { ConexaoSolarStory } from '../conexao-solar/conexao-solar-story';
import { ConexaoSolarPoster } from '../conexao-solar/conexao-solar-poster';
import { GreenSegurosPost } from '../green-seguros/green-seguros-post';
import { GreenSegurosStory } from '../green-seguros/green-seguros-story';
import { GreenSegurosPoster } from '../green-seguros/green-seguros-poster';
import { TelecomPost } from '../telecom/telecom-post';
import { TelecomStory } from '../telecom/telecom-story';
import { TelecomPoster } from '../telecom/telecom-poster';

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

interface MaterialSlot {
  /** Slug do produto — uso interno (rotas, arquivos, esta galeria). Nunca aparece na arte. */
  productSlug: string;
  /** Rótulo do produto — só para esta página de desenvolvimento, nunca renderizado nas peças. */
  productLabel: string;
  format: MaterialFormat;
  Component: ComponentType<MarketingMaterialProps> | null;
}

/**
 * Catálogo central dos 21 materiais (7 produtos × 3 formatos). Cada entrada
 * aponta para o componente real quando ele existir; `Component: null` marca
 * peças ainda não implementadas, exibidas como placeholder na galeria de
 * preview até serem validadas e adicionadas aqui.
 */
export const MATERIALS_REGISTRY: MaterialSlot[] = [
  { productSlug: 'conexao-green', productLabel: 'Conexão Green', format: 'post', Component: ConexaoGreenPost },
  { productSlug: 'conexao-green', productLabel: 'Conexão Green', format: 'story', Component: ConexaoGreenStory },
  { productSlug: 'conexao-green', productLabel: 'Conexão Green', format: 'poster', Component: ConexaoGreenPoster },

  { productSlug: 'conexao-club', productLabel: 'Conexão Club', format: 'post', Component: ConexaoClubPost },
  { productSlug: 'conexao-club', productLabel: 'Conexão Club', format: 'story', Component: ConexaoClubStory },
  { productSlug: 'conexao-club', productLabel: 'Conexão Club', format: 'poster', Component: ConexaoClubPoster },

  { productSlug: 'conexao-livre', productLabel: 'Conexão Livre', format: 'post', Component: ConexaoLivrePost },
  { productSlug: 'conexao-livre', productLabel: 'Conexão Livre', format: 'story', Component: ConexaoLivreStory },
  { productSlug: 'conexao-livre', productLabel: 'Conexão Livre', format: 'poster', Component: ConexaoLivrePoster },

  { productSlug: 'conexao-placas', productLabel: 'Conexão Placas', format: 'post', Component: ConexaoPlacasPost },
  { productSlug: 'conexao-placas', productLabel: 'Conexão Placas', format: 'story', Component: ConexaoPlacasStory },
  { productSlug: 'conexao-placas', productLabel: 'Conexão Placas', format: 'poster', Component: ConexaoPlacasPoster },

  { productSlug: 'conexao-solar', productLabel: 'Conexão Solar', format: 'post', Component: ConexaoSolarPost },
  { productSlug: 'conexao-solar', productLabel: 'Conexão Solar', format: 'story', Component: ConexaoSolarStory },
  { productSlug: 'conexao-solar', productLabel: 'Conexão Solar', format: 'poster', Component: ConexaoSolarPoster },

  { productSlug: 'green-seguros', productLabel: 'Green Seguros', format: 'post', Component: GreenSegurosPost },
  { productSlug: 'green-seguros', productLabel: 'Green Seguros', format: 'story', Component: GreenSegurosStory },
  { productSlug: 'green-seguros', productLabel: 'Green Seguros', format: 'poster', Component: GreenSegurosPoster },

  { productSlug: 'telecom', productLabel: 'Telecom', format: 'post', Component: TelecomPost },
  { productSlug: 'telecom', productLabel: 'Telecom', format: 'story', Component: TelecomStory },
  { productSlug: 'telecom', productLabel: 'Telecom', format: 'poster', Component: TelecomPoster },
];
