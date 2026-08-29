import { expect, test } from '@playwright/test';

import {
  buildE2ERepresentative,
  canRunE2E,
  cleanupRepresentative,
  completeOnboarding,
  e2eSkipReason,
  publicPageOrigin,
  serviceClient,
  signUp,
} from './support/fixtures';

/**
 * SET-106 — os 4 primeiros `btnWhats` de cada árvore (nessa ordem no DOM:
 * Header → Hero → Widget → Consultor) não são mais uniformemente sólidos
 * desde a SET-97 (PUB-02, `commercial-page-base.module.css:295-311`):
 * Header e Consultor são sempre `.btnSecondary` (contorno); Hero é sempre
 * sólido; o Widget varia por árvore (`product-widgets.tsx`'s própria
 * `variant`, e `club-category-widget.tsx` para Club). Ver o comentário na
 * `productsExpected` abaixo para a variante de cada árvore.
 */
const PRIMARY_WHATSAPP_STYLE = { background: 'rgb(0, 179, 89)', color: 'rgb(255, 255, 255)' };
const SECONDARY_WHATSAPP_STYLE = { background: 'rgba(0, 0, 0, 0)', color: 'rgb(0, 137, 63)' };

test.describe('sete Commercial Pages profissionais (SET-78)', () => {
  test.skip(!canRunE2E, e2eSkipReason);

  // O timeout global de 90s (playwright.config.ts) já é justo para o resto
  // da suíte (ver o comentário lá sobre critical-path.spec.ts), mas este
  // spec faz 14 navegações reais (7 produtos × 2 viewports), cada uma com
  // várias asserções de layout/CSS computado, mais uma segunda passada de
  // interação por produto no fim — achado medindo isoladamente com um
  // timeout ampliado: uma execução real, sem nenhum bug, levou ~108s
  // (1.8min). 90s nunca teve margem para este spec especificamente, não é
  // flakiness — é mais trabalho por teste do que o orçamento padrão cobre.
  // 240s dá folga confortável acima do pior caso observado.
  test.describe.configure({ timeout: 240_000 });

  const fixture = buildE2ERepresentative('templates');
  const service = canRunE2E ? serviceClient() : null;

  test.afterAll(async () => {
    if (service) await cleanupRepresentative(service, fixture.email);
  });

  test('renderiza os sete produtos em desktop e mobile sem divergência estrutural', async ({ page, context }) => {
    await signUp(page, fixture);
    await completeOnboarding(page, fixture);

    const representative = await expect.poll(async () => {
      const { data } = await service!
        .from('representatives')
        .select('id')
        .eq('slug', fixture.slug)
        .maybeSingle();
      return data;
    }, { timeout: 15_000 }).not.toBeNull().then(async () => {
      const { data } = await service!.from('representatives').select('id').eq('slug', fixture.slug).single();
      return data!;
    });

    const { data: products, error: productsError } = await service!
      .from('products')
      .select('id, slug')
      .in('slug', productsExpected.map((item)=>item.slug));
    expect(productsError).toBeNull();
    expect(products).toHaveLength(7);

    const { error: activationError } = await service!.from('product_activations').upsert(
      products!.map((product) => ({
        representative_id: representative.id,
        product_id: product.id,
        status: 'published',
        published_at: new Date().toISOString(),
      })),
      { onConflict: 'representative_id,product_id' },
    );
    expect(activationError).toBeNull();

    const publicPage = await context.newPage();
    for (const viewport of [{ width: 1280, height: 800 }, { width: 393, height: 852 }]) {
      await publicPage.setViewportSize(viewport);
      for (const product of products!) {
        const template = productsExpected.find((item)=>item.slug===product.slug)!;
        await publicPage.goto(`${publicPageOrigin(fixture)}/${product.slug}`);
        await expect(publicPage.getByRole('heading', { level: 1, name: template.headline })).toBeVisible();
        await expect(publicPage.locator('#quero-simular').getByRole('button', { name: template.leadButton })).toBeVisible();
        await expect(publicPage.getByRole('link', { name: 'Política de Privacidade' })).toBeVisible();
        await expect(publicPage.getByText(/Site produzido por/)).toBeVisible();
        await expect(publicPage.getByText(/O Setnar é uma plataforma independente/)).toBeVisible();
        await expect(publicPage.getByText(/Antes de contratar, é importante que você saiba:/)).toHaveCount(0);
        const footerAlignment = await publicPage.locator('footer').evaluate((footer) => {
          const rect = footer.getBoundingClientRect();
          return Math.abs((rect.left + rect.width / 2) - window.innerWidth / 2);
        });
        expect(footerAlignment).toBeLessThanOrEqual(1);
        const firstWhatsappButtons = await publicPage.locator('a[class*="btnWhats"]').evaluateAll((buttons) => buttons.slice(0, 4).map((button) => {
          const style = getComputedStyle(button);
          return { background: style.backgroundColor, color: style.color };
        }));
        expect(firstWhatsappButtons).toHaveLength(4);
        expect(firstWhatsappButtons).toEqual([
          SECONDARY_WHATSAPP_STYLE, // Header — sempre secundário (SET-97 PUB-02)
          PRIMARY_WHATSAPP_STYLE, // Hero — sempre sólido
          template.widgetStyle, // Widget — varia por árvore
          SECONDARY_WHATSAPP_STYLE, // Consultor — sempre secundário
        ]);
        const visualIdentity = await publicPage.locator('main#conteudo').evaluate((main) => {
          const style = getComputedStyle(main);
          const header = main.querySelector('header');
          // Mesmo elemento checado em firstWhatsappButtons[0] — id="cta-header"
          // é secundário desde a SET-97 (PUB-02), não mais o "primaryAction"
          // que o nome antigo desta variável sugeria.
          const headerCta = main.querySelector('header a[id="cta-header"]');
          return {
            surface: style.getPropertyValue('--fundo').trim(),
            brand: style.getPropertyValue('--verde-vivo').trim(),
            sun: style.getPropertyValue('--amarelo-sol').trim(),
            headerBackground: header ? getComputedStyle(header).backgroundColor : '',
            actionBackground: headerCta ? getComputedStyle(headerCta).backgroundColor : '',
          };
        });
        expect(visualIdentity).toEqual({
          surface: '#f5faf6',
          brand: '#00b359',
          sun: '#f2a70b',
          headerBackground: 'rgba(246, 248, 244, 0.94)',
          actionBackground: SECONDARY_WHATSAPP_STYLE.background,
        });
        expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }
    }

    await publicPage.setViewportSize({ width: 1280, height: 800 });

    await publicPage.goto(`${publicPageOrigin(fixture)}/conexao-green`);
    await publicPage.getByLabel('Quanto você paga de luz por mês?').fill('1000');
    await expect(publicPage.getByText('10%', { exact: true })).toBeVisible();

    await publicPage.goto(`${publicPageOrigin(fixture)}/conexao-livre`);
    for (const question of await publicPage.getByRole('button', { name: 'Sim', exact: true }).all()) {
      await question.click();
    }
    await expect(publicPage.getByRole('status').filter({ hasText: 'perfil Grupo A' })).toBeVisible();

    await publicPage.goto(`${publicPageOrigin(fixture)}/conexao-placas`);
    await publicPage.getByRole('tab', { name: 'À vista' }).click();
    await expect(publicPage.getByText('Pagamento integral pelo valor apresentado na proposta')).toBeVisible();

    await publicPage.goto(`${publicPageOrigin(fixture)}/green-seguros`);
    await publicPage.getByRole('tab', { name: 'Furto e Roubo' }).click();
    await expect(publicPage.getByText('Simular o plano Furto e Roubo')).toBeVisible();

    await publicPage.goto(`${publicPageOrigin(fixture)}/telecom`);
    await expect(publicPage.locator('section#topo ul').first()).toHaveCSS('display', 'block');
    await publicPage.getByRole('tab', { name: 'Número novo' }).click();
    await expect(publicPage.getByText('R$ 104,90')).toBeVisible();

    await publicPage.goto(`${publicPageOrigin(fixture)}/conexao-solar`);
    await expect(publicPage.locator('section#topo ul').first()).toHaveCSS('display', 'block');

    const firstInteractiveButton = publicPage.getByRole('button').first();
    await firstInteractiveButton.focus();
    await expect(firstInteractiveButton).toBeFocused();
  });
});
  // widgetStyle (SET-106): secundário em Club (club-category-widget.tsx,
  // hardcoded), Telecom/Solar/Placas (product-widgets.tsx, variant="secondary")
  // — árvores onde o widget é exploratório. Sólido em Green/Livre/GreenSeguros
  // (product-widgets.tsx, variant padrão "primary") — onde o widget já é a
  // própria ferramenta de qualificação (calculadora/quiz/seletor).
  // leadButton: texto do botão de ENVIO do formulário (#quero-simular), não
  // do CTA do Hero. A SET-97 (PUB-03) deu texto próprio ao botão do
  // formulário em Club/Livre/Placas/Solar — antes duplicava literalmente o
  // texto do Hero; Green/GreenSeguros/Telecom já tinham texto distinto e
  // não mudaram.
  const productsExpected = [
    { slug:'conexao-club', headline:'Economize todos os dias em mais de 600 mil produtos e serviços, no Brasil inteiro.', leadButton:'Prefiro que me chamem', widgetStyle: SECONDARY_WHATSAPP_STYLE },
    { slug:'conexao-green', headline:'Cansado de ver a conta de luz subir todo mês? Dá pra pagar menos, sem obra e sem trocar de distribuidora.', leadButton:'Quero saber meu desconto', widgetStyle: PRIMARY_WHATSAPP_STYLE },
    { slug:'conexao-livre', headline:'Sua empresa é Grupo A? Migre para o Mercado Livre de Energia e reduza o custo da sua conta.', leadButton:'Quero ser contatado sobre a migração', widgetStyle: PRIMARY_WHATSAPP_STYLE },
    { slug:'conexao-placas', headline:'Tenha suas próprias placas solares e pare de depender só do desconto na conta de luz.', leadButton:'Quero ser contatado sobre a proposta', widgetStyle: SECONDARY_WHATSAPP_STYLE },
    { slug:'conexao-solar', headline:'Energia solar com 50% de desconto na primeira fatura e uma central dedicada do início ao fim.', leadButton:'Quero ser contatado sobre a análise', widgetStyle: SECONDARY_WHATSAPP_STYLE },
    { slug:'green-seguros', headline:'Seguro pro seu carro, mês a mês, sem anuidade e sem multa de cancelamento.', leadButton:'Quero simular meu seguro', widgetStyle: PRIMARY_WHATSAPP_STYLE },
    { slug:'telecom', headline:'Leve seu número de graça e ganhe internet que acumula todo mês.', leadButton:'Quero saber mais', widgetStyle: SECONDARY_WHATSAPP_STYLE },
  ] as const;
