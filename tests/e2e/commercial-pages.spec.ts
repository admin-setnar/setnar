import { expect, test } from '@playwright/test';

import { COMMERCIAL_PAGE_TEMPLATES } from '../../src/modules/representatives/domain/commercial-page-template';
import {
  buildE2ERepresentative,
  canRunE2E,
  cleanupRepresentative,
  completeOnboarding,
  e2eSkipReason,
  serviceClient,
  signUp,
} from './support/fixtures';

test.describe('sete Commercial Pages profissionais (SET-78)', () => {
  test.skip(!canRunE2E, e2eSkipReason);

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
      .in('slug', Object.keys(COMMERCIAL_PAGE_TEMPLATES));
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
        const template = COMMERCIAL_PAGE_TEMPLATES[product.slug as keyof typeof COMMERCIAL_PAGE_TEMPLATES];
        await publicPage.goto(`http://${fixture.slug}.localhost:3000/${product.slug}`);
        await expect(publicPage.getByRole('heading', { level: 1, name: template.headline })).toBeVisible();
        await expect(publicPage.locator('#quero-simular').getByRole('button', { name: template.leadButton })).toBeVisible();
        await expect(publicPage.getByRole('link', { name: 'Política de Privacidade da SETNAR' })).toBeVisible();
        await expect(publicPage.getByText('Página produzida pela SETNAR')).toBeVisible();
        const visualIdentity = await publicPage.locator('main[data-vertical="igreen"]').evaluate((main) => {
          const style = getComputedStyle(main);
          const header = main.querySelector('header');
          const primaryAction = main.querySelector('header a');
          return {
            surface: style.getPropertyValue('--surface').trim(),
            brand: style.getPropertyValue('--brand').trim(),
            sun: style.getPropertyValue('--commercial-sun').trim(),
            headerBackground: header ? getComputedStyle(header).backgroundColor : '',
            actionBackground: primaryAction ? getComputedStyle(primaryAction).backgroundColor : '',
          };
        });
        expect(visualIdentity).toEqual({
          surface: '245 250 246',
          brand: '0 137 63',
          sun: '242 167 11',
          headerBackground: 'rgba(245, 250, 246, 0.95)',
          actionBackground: 'rgb(0, 137, 63)',
        });
        expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }
    }

    const firstInteractiveButton = publicPage.getByRole('button').first();
    await firstInteractiveButton.focus();
    await expect(firstInteractiveButton).toBeFocused();
  });
});
