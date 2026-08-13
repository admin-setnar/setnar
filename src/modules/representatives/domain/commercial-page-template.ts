export interface CommercialPageItem {
  readonly title: string;
  readonly description: string;
}

export interface CommercialPageFaq {
  readonly question: string;
  readonly answer: string;
}

export type ProductWidget =
  | 'club-categories'
  | 'green-calculator'
  | 'livre-eligibility'
  | 'placas-payment'
  | 'solar-benefits'
  | 'seguros-coverage'
  | 'telecom-plans';

export interface CommercialPageTemplate {
  readonly slug: string;
  readonly eyebrow: string;
  readonly headline: string;
  readonly subheadline: string;
  readonly heroNote: string;
  readonly trustPoints: readonly string[];
  readonly widget: ProductWidget;
  readonly howItWorksTitle: string;
  readonly howItWorksIntro: string;
  readonly steps: readonly CommercialPageItem[];
  readonly offerTitle: string;
  readonly offerIntro: string;
  readonly offerItems: readonly CommercialPageItem[];
  readonly faq: readonly CommercialPageFaq[];
  readonly finalTitle: string;
  readonly finalDescription: string;
  readonly leadButton: string;
  readonly thankYouDescription: string;
  readonly footerNotice: string;
}

const templates = {
  'conexao-club': {
    slug: 'conexao-club', eyebrow: 'Clube de benefícios',
    headline: 'Economize todos os dias em mais de 600 mil produtos e serviços, no Brasil inteiro.',
    subheadline: 'Supermercado, farmácia, combustível, viagem e lazer com desconto exclusivo. Você ativa uma vez e usa sempre que quiser.',
    heroNote: 'Ativação rápida pelo app · Valor confirmado no WhatsApp',
    trustPoints: ['+600 mil produtos e serviços', 'Ativação rápida pelo app', 'Sem trocar de distribuidora ou operadora'],
    widget: 'club-categories', howItWorksTitle: 'Como funciona, em 4 passos', howItWorksIntro: 'Ativa uma vez, usa sempre que quiser.',
    steps: [
      { title: 'Você ativa o Club', description: 'Rápido, direto pelo WhatsApp com seu licenciado.' },
      { title: 'Baixa o app iGreen Club', description: 'Disponível para Android e iOS.' },
      { title: 'Escolhe o parceiro', description: 'Busca por categoria ou pelo estabelecimento mais perto de você.' },
      { title: 'Aproveita o desconto', description: 'Direto na hora da compra, sem burocracia.' },
    ],
    offerTitle: 'Categorias com desconto', offerIntro: 'Uma pequena amostra do que você encontra no app.',
    offerItems: ['Supermercados','Alimentação','Viagens','Lazer','Compras online','Combustível','Farmácias','E muito mais'].map((title) => ({ title, description: 'Consulte os parceiros e as condições disponíveis na sua região.' })),
    faq: [
      { question: 'Preciso ser cliente de outro produto iGreen para ter o Club?', answer: 'Não. O Conexão Club é independente e pode ser ativado sem outro produto iGreen.' },
      { question: 'Quanto custa a assinatura?', answer: 'O valor e as formas de pagamento são confirmados com seu licenciado no WhatsApp.' },
      { question: 'Posso cancelar quando quiser?', answer: 'Sim. As condições exatas são confirmadas no momento da ativação.' },
      { question: 'O clube funciona em todo o Brasil?', answer: 'A rede está distribuída pelo país, mas a quantidade de opções varia por região.' },
    ],
    finalTitle: 'Fale agora e ative seu Conexão Club em poucos minutos', finalDescription: 'É só chamar no WhatsApp. Sem compromisso.', leadButton: 'Quero ativar meu Club',
    thankYouDescription: 'Nossa equipe entra em contato em breve para ativar seu acesso ao clube de benefícios, sem compromisso.',
    footerNotice: 'Rede de parceiros e condições sujeitas a alteração. Confirme as condições antes da ativação.',
  },
  'conexao-green': {
    slug: 'conexao-green', eyebrow: 'Sem instalar placa solar',
    headline: 'Cansado de ver a conta de luz subir todo mês? Dá para pagar menos, sem obra e sem trocar de distribuidora.',
    subheadline: 'O desconto vem de créditos de energia renovável. Você continua com a mesma distribuidora, a mesma instalação e a mesma rotina — só a fatura muda.',
    heroNote: 'Cadastro sem custo · Resposta em minutos pelo WhatsApp',
    trustPoints: ['Modelo amparado pela Lei 14.300/2022', 'Sem custo de adesão', 'Mesma distribuidora de sempre'],
    widget: 'green-calculator', howItWorksTitle: 'Como funciona, em 4 passos', howItWorksIntro: 'Sem burocracia e sem mudar nada na sua casa ou empresa.',
    steps: [
      { title: 'Você faz o cadastro', description: 'Rápido, sem custo, direto pelo WhatsApp.' },
      { title: 'Sua energia é compensada', description: 'Você recebe créditos de fontes renováveis injetados na rede.' },
      { title: 'O desconto chega todo mês', description: 'Você escolhe receber em fatura única ou em duas faturas.' },
      { title: 'Nada muda em casa', description: 'Mesma distribuidora e mesma instalação elétrica.' },
    ],
    offerTitle: 'Quem pode participar', offerIntro: 'Confira se o seu perfil se encaixa antes de falar com a gente.',
    offerItems: [
      { title: 'Residências e empresas', description: 'Perfis de diferentes portes podem aderir.' },
      { title: 'Conta em seu nome', description: 'A fatura deve estar no seu nome ou no nome da empresa.' },
      { title: 'Sem obra', description: 'Não é necessário instalar placas solares.' },
    ],
    faq: [
      { question: 'Tem algum custo para aderir?', answer: 'Não há custo de adesão nem taxa de entrada.' },
      { question: 'Vou receber uma ou duas contas?', answer: 'Você escolhe entre faturas separadas ou uma fatura única, conforme as opções apresentadas na adesão.' },
      { question: 'Posso cancelar quando quiser?', answer: 'As faixas padrão não têm fidelidade; descontos a partir de 20% têm fidelidade mínima de 12 meses. Confirme sua faixa no contrato.' },
      { question: 'Quanto tempo demora para o desconto começar?', answer: 'O primeiro boleto iGreen é emitido entre 90 e 180 dias, conforme a distribuidora.' },
    ],
    finalTitle: 'Fale agora e descubra seu desconto em poucos minutos', finalDescription: 'Receba uma simulação sem compromisso.', leadButton: 'Quero saber meu desconto',
    thankYouDescription: 'Nossa equipe entra em contato em breve para confirmar seu desconto, sem compromisso.',
    footerNotice: 'A simulação é estimativa: impostos, iluminação pública e taxas fixas não entram no desconto. Percentuais, prazos e condições constam no contrato.',
  },
  'conexao-livre': {
    slug: 'conexao-livre', eyebrow: 'Exclusivo para Grupo A',
    headline: 'Sua empresa é Grupo A? Migre para o Mercado Livre de Energia e reduza o custo da sua conta.',
    subheadline: 'Se sua unidade tem transformador próprio e demanda contratada, você pode comprar energia no mercado livre com consultoria especializada.',
    heroNote: 'Análise sem custo · Consultoria para média e alta tensão',
    trustPoints: ['Regulamentação ANEEL/MME', 'Sem trocar de distribuidora', 'Consultoria especializada em Grupo A'],
    widget: 'livre-eligibility', howItWorksTitle: 'Como funciona a migração', howItWorksIntro: 'Um processo conduzido por especialistas, do início ao fim.',
    steps: [
      { title: 'Análise do seu perfil', description: 'Avaliamos consumo e enquadramento no Grupo A.' },
      { title: 'Simulação de economia', description: 'Você recebe uma estimativa da possível economia.' },
      { title: 'Formalização da migração', description: 'A documentação e os trâmites são conduzidos com você.' },
      { title: 'Compra no mercado livre', description: 'A infraestrutura permanece; muda a contratação da energia.' },
    ],
    offerTitle: 'Quem pode migrar', offerIntro: 'A Conexão Livre é exclusiva para clientes do Grupo A.',
    offerItems: [
      { title: 'Transformador próprio', description: 'Unidade com demanda contratada junto à distribuidora.' },
      { title: 'Média ou alta tensão', description: 'Clientes enquadrados no Grupo A.' },
      { title: 'B Optante', description: 'Pode precisar migrar para o Grupo A antes; confirme com um especialista.' },
    ],
    faq: [
      { question: 'O que é um cliente do Grupo A?', answer: 'É uma unidade de média ou alta tensão, normalmente com transformador próprio e demanda contratada.' },
      { question: 'Cliente de baixa tensão pode migrar?', answer: 'Não. Para esse perfil, consulte a Conexão Green.' },
      { question: 'Isso é regulamentado?', answer: 'Sim. O setor é regulado pela ANEEL e a abertura ao Grupo A foi viabilizada pela Portaria MME nº 50/2022.' },
      { question: 'Preciso trocar de distribuidora?', answer: 'Não. A distribuidora continua responsável pela rede; muda a contratação da energia.' },
    ],
    finalTitle: 'Descubra se sua empresa pode migrar', finalDescription: 'Análise inicial sem custo e sem compromisso.', leadButton: 'Quero simular minha migração',
    thankYouDescription: 'Nossa equipe entra em contato para confirmar o enquadramento no Grupo A e simular sua migração.',
    footerNotice: 'A distribuidora local continua responsável pela rede. As condições de contratação constam no contrato com o fornecedor.',
  },
  'conexao-placas': {
    slug: 'conexao-placas', eyebrow: 'Sistema fotovoltaico próprio',
    headline: 'Tenha suas próprias placas solares e escolha a forma de pagamento que cabe no seu bolso.',
    subheadline: 'Projeto personalizado, vistoria técnica e instalação por fornecedores homologados, à vista, financiado ou no cartão.',
    heroNote: 'Proposta sem custo · Financiamento sujeito a análise de crédito',
    trustPoints: ['Fornecedores homologados', 'Vistoria técnica', 'Financiamento sujeito a análise'],
    widget: 'placas-payment', howItWorksTitle: 'Como funciona, passo a passo', howItWorksIntro: 'Do primeiro contato até a instalação do sistema.',
    steps: [
      { title: 'Geramos sua proposta', description: 'Dimensionada pelo consumo e espaço disponível.' },
      { title: 'Você escolhe como pagar', description: 'Financiamento, à vista ou cartão.' },
      { title: 'Vistoria técnica', description: 'A análise confirma a viabilidade no imóvel.' },
      { title: 'Instalação do sistema', description: 'Realizada por fornecedor homologado após aprovação.' },
    ],
    offerTitle: 'Formas de pagamento', offerIntro: 'Todas sujeitas às condições e aprovações da modalidade.',
    offerItems: [
      { title: 'Bancos parceiros', description: 'Simulação sujeita à análise de crédito.' },
      { title: 'Seu banco', description: 'Use a proposta para solicitar financiamento ao seu gerente.' },
      { title: 'À vista', description: 'Pagamento integral conforme a proposta.' },
      { title: 'Cartão', description: 'Parcelamento em até 21 vezes, com juros da operadora.' },
    ],
    faq: [
      { question: 'Quanto custa um sistema?', answer: 'Depende do dimensionamento pelo consumo. A proposta personalizada é apresentada antes da decisão.' },
      { question: 'O financiamento é garantido?', answer: 'Não. Toda modalidade depende da análise da instituição financeira.' },
      { question: 'A instalação é imediata?', answer: 'O prazo depende da aprovação, pagamento e disponibilidade do fornecedor.' },
      { question: 'E se a vistoria pedir adequações?', answer: 'Os custos são do cliente e devem ser explicados antes da confirmação.' },
    ],
    finalTitle: 'Receba sua proposta personalizada', finalDescription: 'Fale no WhatsApp sem compromisso.', leadButton: 'Quero minha proposta',
    thankYouDescription: 'Nossa equipe entra em contato em breve para gerar sua proposta de sistema fotovoltaico.',
    footerNotice: 'Financiamento sujeito a análise. Valores finais são confirmados após proposta e vistoria técnica.',
  },
  'conexao-solar': {
    slug: 'conexao-solar', eyebrow: 'Análise personalizada',
    headline: 'Energia solar com 50% de desconto na primeira fatura e acompanhamento dedicado do início ao fim.',
    subheadline: 'Do envio da documentação à instalação, a Conexão Solar conduz seu processo passo a passo.',
    heroNote: 'Bônus sujeito ao contrato · Análises de crédito e documental · Aprovação não garantida',
    trustPoints: ['Bônus de 50% na 1ª fatura', 'Central dedicada', 'Visita técnica antes da instalação'],
    widget: 'solar-benefits', howItWorksTitle: 'Como funciona, etapa por etapa', howItWorksIntro: 'Atendimento dedicado do início ao fim.',
    steps: [
      { title: 'Envio de documentos', description: 'Você recebe e envia o checklist inicial.' },
      { title: 'Análise de crédito', description: 'Documentos adicionais podem ser solicitados.' },
      { title: 'Formalização', description: 'Contrato e documentos do imóvel são conferidos.' },
      { title: 'Visita e instalação', description: 'Telhado, sombreamento e padrão de energia são avaliados.' },
    ],
    offerTitle: 'Quem pode participar', offerIntro: 'Por ora, a Conexão Solar é destinada a pessoas físicas.',
    offerItems: [
      { title: 'Pessoa física', description: 'Imóvel próprio ou alugado.' },
      { title: 'Análise obrigatória', description: 'Crédito, documentação e visita técnica.' },
      { title: 'Limite atual', description: 'Condomínios, igrejas e pessoas jurídicas ainda não são atendidos.' },
    ],
    faq: [
      { question: 'A aprovação é garantida?', answer: 'Não. Depende das análises de crédito, documentação e visita técnica.' },
      { question: 'Atende condomínios ou empresas?', answer: 'Por ora, atende somente pessoas físicas.' },
      { question: 'Preciso ser dono do imóvel?', answer: 'Não. O imóvel pode ser próprio ou alugado.' },
      { question: 'Como funciona o bônus de 50%?', answer: 'O bônus segue as condições e o prazo definidos no contrato e eventual aditivo.' },
    ],
    finalTitle: 'Dê o primeiro passo com atendimento especializado', finalDescription: 'Converse sem compromisso.', leadButton: 'Quero iniciar minha análise',
    thankYouDescription: 'Nossa equipe entra em contato para enviar o checklist e iniciar a análise do seu perfil.',
    footerNotice: 'Sujeito a análises de crédito e documental. Aprovação, prazos e custos constam no contrato e aditivos.',
  },
  'green-seguros': {
    slug: 'green-seguros', eyebrow: 'Seguro por assinatura',
    headline: 'Seguro para seu carro, mês a mês, sem anuidade e sem multa de cancelamento.',
    subheadline: 'Cobertura com apólice e garantia da BP Seguradora, com assistência 24 horas.',
    heroNote: 'Cotação e aceitação sujeitas à análise da seguradora',
    trustPoints: ['Garantido pela BP Seguradora S.A.', 'Sem anuidade', 'Análise de cobertura de oferta'],
    widget: 'seguros-coverage', howItWorksTitle: 'Como funciona, em 4 passos', howItWorksIntro: 'Uma contratação mensal, com condições apresentadas antes da assinatura.',
    steps: [
      { title: 'Você escolhe o plano', description: 'A cobertura adequada é simulada pelo WhatsApp.' },
      { title: 'Paga a mensalidade', description: 'Sem anuidade fechada no cartão.' },
      { title: 'Aceitação e proteção', description: 'A cobertura começa após aceite e confirmação do pagamento.' },
      { title: 'Renovação mensal', description: 'Cancelamento sem multa, conforme o contrato.' },
    ],
    offerTitle: 'Assistência 24 horas', offerIntro: 'Serviços para situações comuns do dia a dia.',
    offerItems: [
      { title: 'Guincho', description: 'Até a oficina credenciada mais próxima.' },
      { title: 'Pane seca', description: 'Combustível emergencial até o posto mais próximo.' },
      { title: 'Pneu e chaveiro', description: 'Troca pelo estepe e auxílio com chaves.' },
    ],
    faq: [
      { question: 'É um seguro de verdade?', answer: 'Sim. Possui apólice e garantia da BP Seguradora S.A.' },
      { question: 'Como é calculada a perda total?', answer: 'A indenização segue a Tabela FIPE vigente na data do sinistro, após análise.' },
      { question: 'Tem franquia?', answer: 'Pode haver franquia em colisão parcial. Roubo, furto sem recuperação e perda total não têm franquia.' },
      { question: 'Precisa de vistoria?', answer: 'Sim. A vistoria faz parte do processo de aceitação.' },
    ],
    finalTitle: 'Descubra o valor do seu seguro', finalDescription: 'Simule pelo WhatsApp sem compromisso.', leadButton: 'Quero simular meu seguro',
    thankYouDescription: 'Nossa equipe entra em contato em breve para confirmar a simulação do seu seguro.',
    footerNotice: 'Produto garantido pela BP Seguradora S.A. Indenizações dependem de análise e das Condições Gerais da apólice.',
  },
  telecom: {
    slug: 'telecom', eyebrow: 'Portabilidade grátis',
    headline: 'Leve seu número de graça e ganhe internet que acumula todo mês.',
    subheadline: 'Chip com bônus, clube de benefícios e ligações ilimitadas para qualquer operadora do Brasil.',
    heroNote: 'Ativação pelo app iGreen Connect · Sem loja física',
    trustPoints: ['Cobertura nacional', 'Ativação pelo app', 'Cashback exclusivo'],
    widget: 'telecom-plans', howItWorksTitle: 'Como funciona a portabilidade', howItWorksIntro: 'Simples, sem precisar ir a uma loja.',
    steps: [
      { title: 'Você escolhe o plano', description: 'Com a ajuda do seu licenciado.' },
      { title: 'Pede a portabilidade no app', description: 'Usando o ID do seu licenciado.' },
      { title: 'Recebe o chip ou eSIM', description: 'Sem visitar loja física.' },
      { title: 'Número portado', description: 'Sua linha é ativada com o bônus aplicável.' },
    ],
    offerTitle: 'Mais do que um plano de celular', offerIntro: 'Benefícios que acompanham sua linha todo mês.',
    offerItems: [
      { title: 'Internet que acumula', description: 'O saldo passa ao mês seguinte dentro do limite do plano.' },
      { title: 'Clube de benefícios', description: 'Descontos em parceiros participantes.' },
      { title: 'Ligações e WhatsApp', description: 'Uso ilimitado conforme as condições do contrato.' },
    ],
    faq: [
      { question: 'Vou perder meu número?', answer: 'Não. A portabilidade mantém seu número atual.' },
      { question: 'Preciso ir a uma loja?', answer: 'Não. A ativação é realizada pelo app iGreen Connect.' },
      { question: 'O que acontece se eu atrasar?', answer: 'Os dados acumulados podem ser perdidos, conforme o contrato.' },
      { question: 'O bônus de portabilidade vale para número novo?', answer: 'Não. O bônus de +5 GB é exclusivo para portabilidade.' },
    ],
    finalTitle: 'Escolha seu plano em poucos minutos', finalDescription: 'Fale no WhatsApp sem compromisso.', leadButton: 'Quero saber mais',
    thankYouDescription: 'Nossa equipe entra em contato em breve para confirmar seu plano e iniciar sua portabilidade.',
    footerNotice: 'Bônus, franquias, preços e condições estão sujeitos ao contrato de prestação do serviço.',
  },
} satisfies Record<string, CommercialPageTemplate>;

export const COMMERCIAL_PAGE_TEMPLATES = templates;
export type CommercialPageTemplateSlug = keyof typeof templates;

export function getCommercialPageTemplate(slug: string): CommercialPageTemplate | null {
  return slug in templates ? templates[slug as CommercialPageTemplateSlug] : null;
}
