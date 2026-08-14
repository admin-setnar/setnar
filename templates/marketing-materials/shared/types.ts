/**
 * Contrato de dados dos materiais de marketing.
 *
 * A nomenclatura segue os placeholders já usados nas landing pages da SETNAR
 * (ex.: {{REP_NOME}}, {{REP_ID}}, {{REP_WHATSAPP}}, {{REP_CIDADE}}), para que a
 * futura integração seja um mapeamento direto, não uma tradução de campos.
 *
 * IMPORTANTE: nenhuma peça de marketing exibe o nome do produto/serviço como
 * texto visível (ex.: "Conexão Green", "Telecom"). As artes vendem a dor que o
 * serviço resolve, não a marca do produto — o nome só aparece na landing page
 * de destino. A única identificação de marca permitida na arte é a do
 * licenciado (nome, ID e "Licenciado Autorizado iGreen Energy").
 *
 * Nem todo material usa todos os campos — o contrato só disponibiliza os
 * dados; cada peça decide o que exibir (ver ENGINEERING_GUIDELINES do
 * projeto principal, seção de materiais de marketing).
 */
export interface MarketingMaterialProps {
  /** Nome completo do licenciado, ex.: "Mariana Souza". */
  representativeName: string;
  /** Primeiro nome, para CTAs curtos ("Falar com Mariana"). */
  representativeFirstName: string;
  /** ID de licenciado autorizado iGreen Energy, exibido no rodapé de identificação. */
  representativeId: string;
  /**
   * Telefone/WhatsApp do licenciado, já formatado para exibição (ex.:
   * "(41) 99999-9999"). Pode ser nulo — todo material trata a ausência
   * condicionalmente, nunca renderiza um número vazio ou placeholder visual.
   *
   * Prioridade de exibição por formato (ver README para detalhes):
   * Poster = área dedicada e visualmente clara; Story/Post = linha
   * secundária, sem competir com headline/CTA/QR. Nunca é o destino do QR
   * Code — o QR sempre aponta para `publicUrl` (a landing page), que é quem
   * intermedia a conversa antes do WhatsApp.
   */
  representativePhone: string | null;
  /** Cidade de atuação do licenciado. Pode ser nulo. */
  representativeCity: string | null;
  /** URL do avatar do licenciado. Pode ser nulo — as peças não podem quebrar sem ele. */
  representativeAvatarUrl: string | null;
  /** URL pública da landing page do licenciado (destino do QR Code / CTA). */
  publicUrl: string;
  /** Data URL (PNG/SVG) do QR Code já gerado, fornecido externamente. */
  qrCodeDataUrl: string;
}
