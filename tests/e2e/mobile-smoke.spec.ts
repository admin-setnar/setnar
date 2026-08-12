import { expect, test } from '@playwright/test';

import {
  buildE2ERepresentative,
  canRunE2E,
  cleanupRepresentative,
  completeOnboarding,
  e2eSkipReason,
  serviceClient,
  signUp,
} from './support/fixtures';

/**
 * SET-52 — "cenário mobile essencial" (distinto do cenário feliz completo em
 * `critical-path.spec.ts`, que já roda em Desktop Chrome): confirma que o
 * caminho que mais importa em viewport móvel — cadastro/onboarding pelo
 * celular e a página pública/lead, que é para onde vai o tráfego real de um
 * link compartilhado — funciona sob emulação de um Pixel 7 (ver
 * `playwright.config.ts`, projeto "Mobile Chrome"). Não repete billing/
 * analytics — isso já está coberto uma vez no desktop; duplicar aqui não
 * aumenta confiança, só tempo de CI.
 */
test.describe('caminho essencial do MVP (E2E, mobile)', () => {
  test.skip(!canRunE2E, e2eSkipReason);

  const fixture = buildE2ERepresentative('mobile');
  const service = canRunE2E ? serviceClient() : null;

  test.afterAll(async () => {
    if (service) await cleanupRepresentative(service, fixture.email);
  });

  test('cadastro, onboarding, publicação e envio de lead num viewport móvel', async ({ page, context }) => {
    await signUp(page, fixture);
    await completeOnboarding(page, fixture);

    await page.getByRole('button', { name: 'Ativar' }).first().click();
    await expect(page.getByRole('button', { name: 'Publicar' })).toBeEnabled({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByRole('button', { name: 'Despublicar' })).toBeVisible({ timeout: 15_000 });

    const { data: rep } = await service!.from('representatives').select('id').eq('slug', fixture.slug).single();
    const { data: activation } = await service!
      .from('product_activations')
      .select('product_id')
      .eq('representative_id', rep!.id as string)
      .eq('status', 'published')
      .single();
    const { data: product } = await service!
      .from('products')
      .select('slug')
      .eq('id', activation!.product_id as string)
      .single();

    const publicPage = await context.newPage();
    await publicPage.goto(`http://${fixture.slug}.localhost:3000/${product!.slug}`);
    await expect(publicPage.getByRole('button', { name: 'Quero saber mais' })).toBeVisible();

    await publicPage.getByLabel('Nome').fill('Visitante Mobile E2E');
    await publicPage.getByLabel('Telefone').fill('(21) 96666-5555');
    await publicPage.getByRole('button', { name: 'Quero saber mais' }).click();
    await expect(publicPage.getByText('Recebemos seus dados')).toBeVisible({ timeout: 10_000 });
  });
});
