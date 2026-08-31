/**
 * Catálogo de copy pronta para o fluxo de Divulgação — "Variante A" (versão
 * oficial, fornecida pelo time), um texto por produto. A copy não varia
 * mais por canal (Instagram Post/Story, WhatsApp, Link direto/QR mostram o
 * mesmo texto) — só o link embutido muda, carregando a atribuição de
 * origem de cada canal. Substitui os 4 templates genéricos por canal desta
 * mesma função (SET-84 D2): aquela primeira rodada validava se
 * material+texto+link prontos aumentavam a execução, deliberadamente sem
 * otimizar por produto; esta é a copy real.
 *
 * "Variante A" no nome sinaliza que pode existir uma B/C no futuro — não
 * construir aqui nenhuma seleção de variante enquanto só a A existe
 * (mesmo critério de não-overengineering do plano original: um mapa
 * `Record<variant, ...>` só nasce quando uma segunda variante existir de
 * fato).
 */
export interface DivulgacaoCopyParams {
  readonly link: string;
  readonly representativeName: string;
  readonly representativeId: string;
}

export interface DivulgacaoCopy {
  readonly text: string;
  /**
   * Ressalva de elegibilidade/uso do produto — nunca faz parte da mensagem
   * enviada ao lead, só orienta o representante antes de enviar. Presente
   * apenas quando o produto exige (hoje, só Conexão Livre: Grupo A).
   */
  readonly note?: string;
}

type DivulgacaoCopyTemplate = (params: DivulgacaoCopyParams) => DivulgacaoCopy;

function signature({ representativeName, representativeId }: DivulgacaoCopyParams): string {
  return `${representativeName} | Licenciado Autorizado iGreen Energy ID ${representativeId}`;
}

const TEMPLATES: Record<string, DivulgacaoCopyTemplate> = {
  'conexao-green': (params) => ({
    text: `Descobri que dá pra reduzir a conta de luz sem instalar nada e sem trocar de distribuidora — testei aqui e o resultado surpreendeu. Se quiser ver quanto cairia na sua conta: 👉 ${params.link}\n\n${signature(params)}`,
  }),
  'conexao-livre': (params) => ({
    text: `Descobri que empresas com transformador próprio conseguem migrar para o Mercado Livre de Energia e pagar bem menos pela mesma energia, sem trocar de infraestrutura. Testei o cálculo com uma fatura real e o resultado impressiona. Manda sua última fatura que eu te mostro: 👉 ${params.link}\n\n${signature(params)}`,
    note: 'Use apenas com leads do Grupo A — empresa com transformador próprio, de média ou alta tensão.',
  }),
  'conexao-placas': (params) => ({
    text: `Descobri que dá pra ter energia solar própria no telhado — sem depender de assinatura pra sempre — e o sistema já se paga com o tanto que você deixa de pagar de conta de luz. Simulei aqui pra ver o tempo de retorno: 👉 ${params.link}\n\n${signature(params)}`,
  }),
  'conexao-solar': (params) => ({
    text: `Descobri que dá pra ter uma usina solar instalada em casa sem comprar o equipamento nem dar entrada — só uma mensalidade, geralmente menor que a conta de luz atual. Testei a simulação e fiquei surpreso: 👉 ${params.link}\n\n${signature(params)}`,
  }),
  'green-seguros': (params) => ({
    text: `Descobri um seguro de carro por assinatura — sem fidelidade de 1 ano, com guincho e assistência 24h incluídos — e o valor mensal me surpreendeu comparado ao seguro tradicional. Cotei o meu aqui: 👉 ${params.link}\n\n${signature(params)}`,
  }),
  telecom: (params) => ({
    text: `Descobri um plano de celular que acumula internet todo mês e ainda dá bônus extra de dados se você portar seu número — testei e sobrou muito mais giga do que eu esperava. Dá uma olhada nos planos: 👉 ${params.link}\n\n${signature(params)}`,
  }),
  'conexao-club': (params) => ({
    text: `Descobri um clube com desconto em mais de 600 mil estabelecimentos — mercado, farmácia, viagem, restaurante — e testei em algumas compras do mês, a economia surpreendeu. Confere os parceiros na sua região: 👉 ${params.link}\n\n${signature(params)}`,
  }),
};

/**
 * Resolve o texto pronto (Variante A) para o produto do fluxo de
 * Divulgação. `null` só para um `productSlug` sem template — não deve
 * acontecer na prática, já que o fluxo só lista produtos com materiais
 * (`hasMaterialsForProduct`), mas mantém o contrato defensivo em vez de
 * assumir cobertura total do catálogo.
 */
export function resolveDivulgacaoCopy(productSlug: string, params: DivulgacaoCopyParams): DivulgacaoCopy | null {
  const template = TEMPLATES[productSlug];
  return template ? template(params) : null;
}
