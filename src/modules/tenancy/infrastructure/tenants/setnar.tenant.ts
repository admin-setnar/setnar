import type { Tenant } from '@/modules/tenancy/domain/tenant';

/**
 * The default tenant.
 *
 * This file is the only place in the codebase where SETNAR-specific words,
 * colors and links appear. A second tenant is a second file exactly like this
 * one — no component, style or type needs to change.
 *
 * Copy note: every claim here is about SETNAR's own software. Nothing states or
 * implies earnings, results, or an affiliation with the brands a representative
 * sells. See README, "Compliance", before editing.
 */
export const setnarTenant: Tenant = {
  id: 'setnar',
  hostnames: ['setnar.com', 'www.setnar.com', 'localhost'],
  locale: 'pt-BR',

  brand: {
    name: 'Setnar',
    legalName: 'Setnar',
    tagline: 'Presença comercial profissional para quem vende por conta própria',
    // Mirrors the defaults in globals.css. Kept explicit so the shape of a
    // white-label override is obvious to whoever adds tenant number two.
    tokens: {
      '--palette-900': '20 33 61',
      '--palette-800': '31 45 80',
      '--palette-700': '51 68 102',
      '--palette-500': '107 114 128',
      '--palette-200': '229 231 235',
      '--palette-50': '248 250 252',
    },
  },

  legal: {
    termsUrl: '/termos',
    privacyUrl: '/privacidade',
    contactEmail: 'contato@setnar.com',
  },

  features: {
    // No social provider is wired in yet — SocialAuthButtons and
    // signInWithProvider stay in the repo, disabled by flag, not deleted.
    googleAuth: false,
    microsoftAuth: false,
    selfServiceSignUp: true,
  },

  vertical: {
    id: 'igreen',
    internalName: 'iGreen Energy',
    // Intentionally omitted: a third-party brand is not displayed on this page.
  },

  marketing: {
    navigation: [
      { label: 'Recursos', href: '#recursos' },
      { label: 'Como funciona', href: '#como-funciona' },
      { label: 'Preços', href: '#precos', placeholder: true },
    ],

    hero: {
      eyebrow: 'Escritório digital para representantes independentes',
      headline: 'Sua página de vendas profissional,',
      headlineAccent: 'pronta hoje.',
      subheadline:
        'O Setnar cria a página comercial dos produtos que você representa — com o seu nome, o seu contato e o seu QR Code. Você compartilha o link e recebe os contatos organizados em um só lugar.',
      primaryAction: 'Começar gratuitamente',
      secondaryAction: 'Entrar',
      reassurance: [
        'Publique em minutos',
        'Sem agência e sem programador',
        'Funciona no celular',
      ],
    },

    howItWorks: {
      eyebrow: 'Como funciona',
      title: 'Três passos entre criar a conta e receber o primeiro contato',
      description:
        'Nenhuma etapa exige conhecimento técnico. O que você precisa fazer é escolher, compartilhar e responder.',
      steps: [
        {
          icon: 'catalog',
          title: 'Escolha um produto',
          description:
            'Ative os produtos que você já representa. O Setnar monta a página de cada um com a sua identificação de representante.',
        },
        {
          icon: 'share',
          title: 'Compartilhe sua página',
          description:
            'Você recebe um link curto e um QR Code prontos para o WhatsApp, a bio das redes, o cartão de visita ou o panfleto impresso.',
        },
        {
          icon: 'inbox',
          title: 'Receba seus leads organizados',
          description:
            'Cada contato chega identificado com a página de origem e fica registrado no seu painel. Nada se perde no meio das conversas.',
        },
      ],
    },

    benefits: {
      eyebrow: 'Recursos',
      title: 'Feito para vender, não para configurar',
      description:
        'O Setnar cuida da parte que costuma travar quem trabalha por conta própria: a presença digital.',
      items: [
        {
          icon: 'speed',
          title: 'Rapidez',
          description:
            'Da criação da conta à página publicada em uma única sessão. Sem briefing, sem espera por terceiros.',
        },
        {
          icon: 'organize',
          title: 'Organização',
          description:
            'Cada contato registrado com origem e data, em uma lista que você consegue acompanhar de verdade.',
        },
        {
          icon: 'centralize',
          title: 'Centralização',
          description:
            'Todos os produtos que você representa em um endereço só. Um link para compartilhar, não uma pasta de PDFs.',
        },
        {
          icon: 'automate',
          title: 'Automação',
          description:
            'Página, link e QR Code gerados automaticamente a cada produto ativado, sempre com seus dados corretos.',
        },
        {
          icon: 'ease',
          title: 'Facilidade',
          description:
            'Uma interface que se explica sozinha, pensada para ser usada do celular entre um atendimento e outro.',
        },
      ],
    },

    callToAction: {
      title: 'Comece agora com a sua primeira página',
      description:
        'Crie sua conta, ative um produto e compartilhe o link ainda hoje.',
      action: 'Criar minha conta',
      footnote: 'Criar conta leva menos de dois minutos.',
    },

    footer: {
      description:
        'Ferramentas de presença digital e organização comercial para profissionais que vendem por conta própria.',
      groups: [
        {
          title: 'Produto',
          links: [
            { label: 'Recursos', href: '#recursos' },
            { label: 'Como funciona', href: '#como-funciona' },
            { label: 'Preços', href: '#precos', placeholder: true },
          ],
        },
        {
          title: 'Empresa',
          links: [
            { label: 'Sobre', href: '#sobre', placeholder: true },
            { label: 'Contato', href: 'mailto:contato@setnar.com' },
          ],
        },
        {
          title: 'Legal',
          links: [
            { label: 'Termos de uso', href: '/termos' },
            { label: 'Política de privacidade', href: '/privacidade' },
          ],
        },
      ],
      social: [
        { icon: 'instagram', label: 'Instagram', href: '#', placeholder: true },
        { icon: 'linkedin', label: 'LinkedIn', href: '#', placeholder: true },
        { icon: 'youtube', label: 'YouTube', href: '#', placeholder: true },
      ],
      legalNotice:
        'O Setnar é uma plataforma independente de ferramentas de vendas. Não é canal oficial das empresas cujos produtos seus usuários representam, e toda página publicada identifica de forma clara o representante responsável por ela.',
    },
  },
};
