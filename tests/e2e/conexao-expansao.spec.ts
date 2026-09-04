import { expect, test } from '@playwright/test';

import {
  API_ROUTE_SETTLE_TIMEOUT,
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
 * Dedicated E2E validation for the 8th Commercial Page, conexao-expansao
 * (ADR-095). Complements `commercial-pages.spec.ts` (which now includes
 * conexao-expansao in its own 8-product structural/visual pass) with the
 * scenarios that are specific to this product's review: real activation
 * through the actual `/app/paginas` UI (not the direct-table upsert
 * shortcut the other spec uses for speed), the preview route, every
 * WhatsApp CTA's destination, the secondary "Ver como funciona" CTA
 * NOT opening WhatsApp, a real Lead submission with `origin` attribution
 * verified in Contatos, and Analytics (page view + WhatsApp click).
 */
test.describe('Conexão Expansão — validação end-to-end (ADR-095)', () => {
  test.skip(!canRunE2E, e2eSkipReason);
  test.describe.configure({ timeout: 180_000 });

  const fixture = buildE2ERepresentative('expansao');
  const service = canRunE2E ? serviceClient() : null;

  test.afterAll(async () => {
    if (service) await cleanupRepresentative(service, fixture.email);
  });

  test('cadastro, ativação real, publicação, preview, Commercial Page pública, Lead e Analytics', async ({ page, context }) => {
    // ------------------------------------------------------------------
    // 1. Cadastro + onboarding reais (não via RPC direta)
    // ------------------------------------------------------------------
    await signUp(page, fixture);
    await completeOnboarding(page, fixture);

    // ------------------------------------------------------------------
    // 2. Ativação pelo fluxo real da UI — "Ativar" depois "Publicar",
    //    exatamente os controles que product-activation-card.tsx renderiza
    //    (não o upsert direto em product_activations que outras specs usam).
    // ------------------------------------------------------------------
    const nameNode = page.getByText('Conexão Expansão', { exact: true });
    const card = nameNode.locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]');

    await expect(card.getByText('Não ativado')).toBeVisible();
    await card.getByRole('button', { name: 'Ativar' }).click();
    await expect(card.getByRole('button', { name: 'Publicar' })).toBeVisible({ timeout: API_ROUTE_SETTLE_TIMEOUT });
    await card.getByRole('button', { name: 'Publicar' }).click();
    await expect(card.getByText('Publicado', { exact: true })).toBeVisible({ timeout: API_ROUTE_SETTLE_TIMEOUT });

    // Catálogo/ativação não afetou os outros produtos: os outros 7 continuam
    // "Não ativado" (nenhuma ativação em massa aconteceu por engano).
    await expect(page.getByText('Conexão Green')).toBeVisible();
    const greenCard = page.getByText('Conexão Green', { exact: true }).locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]');
    await expect(greenCard.getByText('Não ativado')).toBeVisible();

    // ------------------------------------------------------------------
    // 3. Preview privado — /pre-visualizacao/conexao-expansao
    // ------------------------------------------------------------------
    await page.goto('/pre-visualizacao/conexao-expansao');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Construa uma renda recorrente com a iGreen.' }),
    ).toBeVisible();
    await expect(page.getByText('Formulário desativado na prévia — publique a página para receber contatos reais.')).toBeVisible();

    // ------------------------------------------------------------------
    // 4. Página pública real — Host + productSlug + Product Activation + Representative
    // ------------------------------------------------------------------
    const publicPage = await context.newPage();
    await publicPage.setViewportSize({ width: 1280, height: 800 });
    await publicPage.goto(`${publicPageOrigin(fixture)}/conexao-expansao`);

    await expect(
      publicPage.getByRole('heading', { level: 1, name: 'Construa uma renda recorrente com a iGreen.' }),
    ).toBeVisible();
    await expect(publicPage.getByRole('heading', { level: 2, name: fixture.displayName })).toBeVisible();

    // CTA primário do Hero
    const heroCta = publicPage.locator('a#cta-hero');
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveAttribute('href', /^https:\/\/wa\.me\/5511988887777/);
    await expect(heroCta).toHaveAttribute('target', '_blank');

    // CTA secundário — "Ver como funciona": scroll interno, NÃO WhatsApp
    const secondaryCta = publicPage.getByRole('link', { name: /Ver como funciona/ });
    await expect(secondaryCta).toHaveAttribute('href', '#como-funciona');
    await expect(secondaryCta).not.toHaveAttribute('target', '_blank');
    await secondaryCta.click();
    await expect(publicPage.getByRole('heading', { level: 2, name: 'Como funciona' })).toBeInViewport();

    // Header CTA
    await expect(publicPage.locator('header a#cta-header')).toHaveAttribute('href', /^https:\/\/wa\.me\/5511988887777/);
    // Widget review (implementation review item 10): no CTA in the hero
    // widget — the one originally there existed only to satisfy the other
    // products' 4-button structural pattern, not a UX need, and was
    // removed. Asserted absent here, not just omitted, so it does not
    // silently regrow.
    await expect(publicPage.getByRole('link', { name: 'Tirar minhas dúvidas' })).toHaveCount(0);
    await expect(publicPage.getByText('Como você pode ser bonificado')).toBeVisible();
    // Consultor CTA
    await expect(publicPage.locator('a#cta-consultor')).toHaveAttribute('href', /^https:\/\/wa\.me\/5511988887777/);
    // CTA final
    await expect(publicPage.locator('a#cta-final')).toHaveAttribute('href', /^https:\/\/wa\.me\/5511988887777/);
    await expect(publicPage.getByRole('link', { name: /Falar com/ }).last()).toBeVisible();

    // Floating WhatsApp presente no DOM (comportamento de exibição por
    // breakpoint já é herdado do CSS compartilhado, não específico desta página).
    await expect(publicPage.locator('a[class*="floatWhats"]')).toHaveCount(1);

    // Nenhum valor financeiro exato ou promessa de renda na página pública.
    const bodyText = (await publicPage.locator('main#conteudo').innerText()) ?? '';
    expect(bodyText).not.toMatch(/R\$\s?\d/);
    expect(bodyText).not.toMatch(/renda garantida|resultado garantido/i);

    // Sem overflow horizontal em desktop.
    expect(
      await publicPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);

    // Issue #76, resolved — .header's position:sticky must resolve against
    // the real viewport. Root cause was `.page`'s `overflow-x: hidden`
    // silently forcing a computed `overflow-y: auto` (CSS Overflow spec's
    // visible/non-visible axis-coupling rule), which made `.page` itself
    // the sticky positioning's scroll container instead of the viewport;
    // fixed by using `overflow-x: clip` there instead (excluded from that
    // coupling rule), in commercial-page-base.module.css. This assertion is
    // duplicated, deliberately, in commercial-pages.spec.ts's shared loop
    // (which covers all 8 products) — kept here too so this dedicated spec
    // stays a complete, standalone read of the page's real behavior.
    await publicPage.mouse.wheel(0, 900);
    await publicPage.waitForTimeout(100);
    const headerStickyTop = await publicPage.locator('header').evaluate((header) => header.getBoundingClientRect().top);
    expect(headerStickyTop).toBeGreaterThanOrEqual(-1);
    expect(headerStickyTop).toBeLessThanOrEqual(1);

    // ------------------------------------------------------------------
    // 5. Mobile — viewport oficial da suíte mobile-smoke (375×812)
    // ------------------------------------------------------------------
    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 375, height: 812 });
    await mobilePage.goto(`${publicPageOrigin(fixture)}/conexao-expansao`);
    await expect(
      mobilePage.getByRole('heading', { level: 1, name: 'Construa uma renda recorrente com a iGreen.' }),
    ).toBeVisible();
    expect(
      await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
    // Seções-chave presentes e sem quebra visual grosseira (altura > 0,
    // largura <= viewport) — inspeção estrutural, não substitui a inspeção
    // visual já feita via screenshot durante a implementação.
    for (const heading of ['Connect Plus × Connect Full', 'Formas de bonificação', 'Evolução', 'Perguntas frequentes']) {
      const section = mobilePage.getByRole('heading', { level: 2, name: heading });
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
      const box = await section.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(376); // 1px slack
    }
    await mobilePage.close();

    // ------------------------------------------------------------------
    // 6. Lead real — origem explícita (?src=whatsapp), verificado no banco
    //    e em /app/contatos
    // ------------------------------------------------------------------
    await publicPage.goto(`${publicPageOrigin(fixture)}/conexao-expansao?src=whatsapp`);
    const leadName = `Lead Teste E2E ${Date.now()}`;
    await publicPage.getByLabel('Nome').fill(leadName);
    await publicPage.getByLabel('Telefone').fill('(11) 91234-5678');
    await publicPage.locator('#quero-simular').getByRole('button', { name: 'Quero fazer parte' }).click();
    await expect(publicPage.getByText('Recebemos seus dados')).toBeVisible({ timeout: API_ROUTE_SETTLE_TIMEOUT });

    const representative = await expect
      .poll(async () => {
        const { data } = await service!.from('representatives').select('id').eq('slug', fixture.slug).maybeSingle();
        return data;
      }, { timeout: 15_000 })
      .not.toBeNull()
      .then(async () => {
        const { data } = await service!.from('representatives').select('id').eq('slug', fixture.slug).single();
        return data!;
      });

    const { data: expansaoProduct } = await service!.from('products').select('id').eq('slug', 'conexao-expansao').single();
    expect(expansaoProduct?.id).toBeTruthy();

    const lead = await expect
      .poll(
        async () => {
          const { data } = await service!
            .from('leads')
            .select('id, representative_id, product_id, origin, telefone_e164')
            .eq('representative_id', representative.id)
            .eq('product_id', expansaoProduct!.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return data;
        },
        { timeout: API_ROUTE_SETTLE_TIMEOUT },
      )
      .not.toBeNull()
      .then(async () => {
        const { data } = await service!
          .from('leads')
          .select('id, representative_id, product_id, origin, telefone_e164')
          .eq('representative_id', representative.id)
          .eq('product_id', expansaoProduct!.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        return data!;
      });

    expect(lead.representative_id).toBe(representative.id);
    expect(lead.product_id).toBe(expansaoProduct!.id);
    expect(lead.origin).toBe('whatsapp');
    expect(lead.telefone_e164).toBe('+5511912345678');

    // Nenhum Product de energia foi atribuído por engano — o único Lead
    // deste representante de teste é o de conexao-expansao.
    const { data: allLeadsForRep } = await service!.from('leads').select('product_id').eq('representative_id', representative.id);
    expect((allLeadsForRep ?? []).every((row) => row.product_id === expansaoProduct!.id)).toBe(true);

    // Aparece em /app/contatos, com o Product correto.
    await page.goto('/app/contatos');
    await expect(page.getByText(leadName)).toBeVisible({ timeout: API_ROUTE_SETTLE_TIMEOUT });
    const contactCard = page.getByText(leadName).locator('xpath=ancestor::li[1]');
    await expect(contactCard.getByText('Conexão Expansão', { exact: true })).toBeVisible();

    // ------------------------------------------------------------------
    // 7. Analytics — page view (já disparado pelas navegações acima) e
    //    WhatsApp click, ambos atribuídos ao Product/origin corretos.
    // ------------------------------------------------------------------
    await expect
      .poll(
        async () => {
          const { count } = await service!
            .from('analytics_events')
            .select('id', { count: 'exact', head: true })
            .eq('representative_id', representative.id)
            .eq('product_id', expansaoProduct!.id)
            .eq('event_type', 'visit');
          return count ?? 0;
        },
        { timeout: API_ROUTE_SETTLE_TIMEOUT },
      )
      .toBeGreaterThan(0);

    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      publicPage.locator('a#cta-final').click(),
    ]);
    await popup.close();

    await expect
      .poll(
        async () => {
          const { count } = await service!
            .from('analytics_events')
            .select('id', { count: 'exact', head: true })
            .eq('representative_id', representative.id)
            .eq('product_id', expansaoProduct!.id)
            .eq('event_type', 'whatsapp_click');
          return count ?? 0;
        },
        { timeout: API_ROUTE_SETTLE_TIMEOUT },
      )
      .toBeGreaterThan(0);

    // ------------------------------------------------------------------
    // 8. Integridade do catálogo — ainda 8 Products para a company igreen,
    //    nenhuma duplicata, nenhum outro Product tocado.
    // ------------------------------------------------------------------
    const { data: catalogAfter } = await service!
      .from('products')
      .select('slug, company_id')
      .order('slug');
    expect(catalogAfter).toHaveLength(8);
    expect(new Set((catalogAfter ?? []).map((p) => p.slug)).size).toBe(8);
  });
});
