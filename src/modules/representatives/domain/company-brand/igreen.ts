import type { BrandTokens } from '@/modules/tenancy/domain/tenant';

/**
 * Identidade visual das Commercial Pages iGreen aprovada na SET-78.
 * Os valores vêm dos sete templates de referência em
 * `templates/commercial-pages/`; além da paleta base, os tokens semânticos
 * são redefinidos para impedir que cores do shell SETNAR vazem para a página.
 * O verde escuro continua sendo usado em botões com texto branco para manter
 * contraste AA; o verde vivo permanece como acento visual.
 */
export const IGREEN_TOKENS: BrandTokens = {
  '--palette-900': '7 49 29',
  '--palette-800': '0 137 63',
  '--palette-700': '0 112 52',
  '--palette-500': '0 179 89',
  '--palette-200': '207 238 218',
  '--palette-50': '245 250 246',
  '--surface': '245 250 246',
  '--surface-raised': '255 255 255',
  '--surface-sunken': '225 247 234',
  '--surface-inverted': '7 49 29',
  '--content': '30 36 32',
  '--content-muted': '75 85 78',
  '--content-subtle': '90 105 94',
  '--content-inverted': '255 255 255',
  '--border': '207 238 218',
  '--border-strong': '0 137 63',
  '--brand': '0 137 63',
  '--brand-hover': '7 49 29',
  '--brand-active': '7 49 29',
  '--brand-subtle': '225 247 234',
  '--brand-contrast': '255 255 255',
  '--ring': '0 137 63',
  '--commercial-accent': '0 179 89',
  '--commercial-sun': '242 167 11',
  '--commercial-sun-hover': '219 151 0',
};
