import type { MarketingMaterialProps } from './types';

/**
 * Dados fictícios para preview/desenvolvimento. Nunca usar dados reais de
 * clientes ou licenciados aqui — este arquivo é só para a galeria de preview.
 */

// QR Code de exemplo (mesmo formato/tamanho de um QR real gerado pela
// biblioteca `qrcode` já usada na SETNAR) — usado apenas para preview visual.
const MOCK_QR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAzQAAAM0AQAAAABFCVraAAAEd0lEQVR4nO3dS47bMAyAYbKYvX2D3v9YcwP5BOwioinRyrRF5oEwPxdG/Ig/QBsLEkWpyXfE8etbGBEcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBycH3U0xy4icqjGoV8TkfSrH1YvuDhfGjg4ODg4ODiPx9t4srXhRMcbJiqbicjRL1t+5OMXlGs3HBwcHBycys5bOu8fdf/Q6+2wNeldg82GGybHLnb2GVYv8KjWbjg4ODg4ODgiYmbmayEPVbM2TjJ8nvNg4ODg4ODg4DweefwgRR8hGE7PQYTNrvML96Nau+Hg4ODg4FR2cv/gUi7plnVwdhI8CcGWD9+5JvXaDQcHBwcHp7JzmzcYJw8iNrP/PFxf0KNVazccHBwcHJzKzjB+sB4NONQP0yM2H+6+wKNau+Hg4ODg4LyW42UOVFU9wWAzi3IIZu+9vkH8yaxdXvAX52sCBwcHBwcH5/G4s75Rempi5B/0u5GVuLX8sJ3PXaNau+Hg4ODg4FR2hv7B9LU/Tzw1MWYaxq7B1EnoNRFERM/nPKq1Gw4ODg4OTmXnur5xaxJlkEQkiiTZWRVJp+6Ch8mxezGlHNXaDQcHBwcHp7KT8xO1f/f34dpqzePUXdgXvYd9/ku1dsPBwcHBwXkZx+siikhPORy3YVLVvozRn0sPx6nqPucs1m43HBwcHBycYs6y/sH4Zb9b16CN/40X2DJatXbDwcHBwcGp7Ezf83Zus+A9gHik/2rzaXQNos/QRKJmEv0DHBwcHByc53Om9QuRQ+CnEVN95X3KSZg2cUx/86jWbjg4ODg4OJWdKT/RyySuTiM0n0a64tY8wTFHtXbDwcHBwcGp7FzzBdp8P2YatvU0wipTkfkFHBwcHBycZ3bm+YV2+zXu6uwbOuu8E0NMRuji9BrV2g0HBwcHB6eyc61/4BGZCDJcm8ocyPxIFFlOhZOkXrvh4ODg4OBUdnJ95fS1HzdckLNXMIwz6NQrkLODkZMUq7UbDg4ODg5OZSevUexXt3EF4/hrG59b10mYMhbIP8DBwcHBwXk+J++/EGMAnn9wjgtsbcg/uDO6sOfsBI9q7YaDg4ODg1PZmfoH084JfbXi9KEfP/nT/gsy1D8QIf8ABwcHBwfnqZ2cnxiZAymBIE41X/PSB3H3mttYrd1wcHBwcHBexNEce78ROzVFrQMzM4tH+wv282WRjnBxvjRwcHBwcHBwHo9pfsHHAERkMQYQUwZeZLn/Y9oMOh5m/AAHBwcHB6eIk4YOVPdz6MDXL4zX3tU7Dcc4knCpwli+3XBwcHBwcF7KOVRX8wsiIqL6e97YMe56P+KfnU8KHBwcHBwcnMcjr29M0RcnXBcxRPVlu003+OG6tFFE6rUbDg4ODg5OZWdZ/2AdaclidBw8CcE+eEG1dsPBwcHBwans5PoH6xi2a9qHEgm9zMH0t15HKUe1dsPBwcHBwans6AcDBp8YR7V2w8HBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwYn4AzAWXREF+qUfAAAAAElFTkSuQmCC';

export const mockRepresentative: MarketingMaterialProps = {
  representativeName: 'Mariana Souza',
  representativeFirstName: 'Mariana',
  representativeId: '203984',
  representativePhone: '(31) 99999-9999',
  representativeCity: 'Belo Horizonte',
  representativeAvatarUrl: null,
  publicUrl: 'https://exemplo.setnar.app/mariana',
  qrCodeDataUrl: MOCK_QR_DATA_URL,
};

/** Variante sem telefone/cidade/QR — usada para garantir que as peças não quebram sem esses dados. */
export const mockRepresentativeMinimal: MarketingMaterialProps = {
  representativeName: 'João Pedro Lima',
  representativeFirstName: 'João',
  representativeId: '118420',
  representativePhone: null,
  representativeCity: null,
  representativeAvatarUrl: null,
  publicUrl: 'https://exemplo.setnar.app/joaopedro',
  qrCodeDataUrl: MOCK_QR_DATA_URL,
};
