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
 * SET-91 — gerenciamento de uma página publicada (E2E, desktop): QR Code sob
 * demanda, cópia de link, "Abrir site" e a confirmação de despublicação —
 * o comportamento introduzido pela refatoração de UX do card publicado
 * (`ProductActivationCard`/`PublishedPageActions`/`QrCodeDialog`).
 *
 * O que este spec NÃO tenta provar, de propósito, porque já está provado na
 * camada certa:
 * - Fidelidade do link por trás do QR Code (mesma string de `Abrir site`/
 *   `Copiar link` — decodificar a imagem do QR exigiria uma dependência nova
 *   só para o teste, o que o escopo desta tarefa proíbe). Este spec confirma
 *   que a imagem gerada é um `data:` URI de verdade, não que o payload
 *   decodifica para a URL — isso é responsabilidade de `generateQrCodeDataUrl`
 *   (`shared/lib`), que recebe a mesma `url` que os outros dois controles
 *   usam.
 * - Cálculo/semântica de analytics — `analytics-hub-ui.test.ts`.
 */
test.describe('gerenciamento de página publicada (E2E, desktop)', () => {
  test.skip(!canRunE2E, e2eSkipReason);

  const fixture = buildE2ERepresentative('pubmgmt');
  const service = canRunE2E ? serviceClient() : null;

  test.afterAll(async () => {
    if (service) await cleanupRepresentative(service, fixture.email);
  });

  test('QR Code sob demanda, copiar link, abrir site e confirmação de despublicação', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await test.step('cadastro, onboarding, ativação e publicação', async () => {
      await signUp(page, fixture);
      await completeOnboarding(page, fixture);
      await page.getByRole('button', { name: 'Ativar' }).first().click();
      await expect(page.getByRole('button', { name: 'Publicar' })).toBeEnabled({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Publicar' }).click();
      await expect(page.getByRole('button', { name: 'Despublicar' })).toBeVisible({ timeout: 15_000 });
    });

    const { expectedUrl, productSlug } = await test.step('resolve a URL pública via banco', async () => {
      const { data: rep } = await service!.from('representatives').select('id').eq('slug', fixture.slug).single();
      const { data: activation } = await service!
        .from('product_activations')
        .select('product_id')
        .eq('representative_id', rep!.id as string)
        .eq('status', 'published')
        .single();
      const { data: product } = await service!
        .from('products')
        .select('slug, company:companies!inner(slug)')
        .eq('id', activation!.product_id as string)
        .single();
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://setnar.com').replace(/\/$/, '');
      const rootHost = new URL(siteUrl).hostname;
      const slug = product!.slug as string;
      const companySlug = (product!.company as unknown as { slug: string }).slug;
      // <representative-slug>.<company-slug>.<rootHost> (ADR-092) — same
      // composition buildCommercialPageUrl uses, replicated here from the
      // DB directly since this step exists to derive the expected value
      // independently, not to call the app's own helper.
      return { expectedUrl: `https://${fixture.slug}.${companySlug}.${rootHost}/${slug}`, productSlug: slug };
    });

    await test.step('a URL pública aparece uma única vez, sem overflow, e não como QR Code permanente', async () => {
      await expect(page.getByText('Página no ar:')).toHaveCount(0);
      await expect(page.getByText(expectedUrl.replace(/^https:\/\//, ''))).toBeVisible();
      await expect(page.getByRole('img', { name: 'QR Code da página pública' })).toHaveCount(0);
    });

    await test.step('"Copiar link" copia a URL pública e dá feedback visível', async () => {
      await page.getByRole('button', { name: 'Copiar link' }).click();
      await expect(page.getByRole('button', { name: 'Link copiado' })).toBeVisible();
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(expectedUrl);
    });

    await test.step('"Abrir site" aponta para a URL pública e preserva o painel (nova aba)', async () => {
      // Não segue a navegação de verdade: `buildCommercialPageUrl` monta um
      // host de subdomínio (`<slug>.<rootHost>`) que só resolve de fato em
      // produção — o mesmo motivo pelo qual `critical-path.spec.ts` navega a
      // página pública por `http://<slug>.localhost:3000/<slug-do-produto>`
      // explicitamente, nunca clicando o link renderizado pelo hub.
      // `target="_blank"`/`rel="noopener noreferrer"` são o contrato
      // observável de "abre em nova aba sem afetar o painel" sem depender
      // de DNS/porta do ambiente de teste.
      const openSiteLink = page.getByRole('link', { name: 'Abrir site' });
      await expect(openSiteLink).toHaveAttribute('href', expectedUrl);
      await expect(openSiteLink).toHaveAttribute('target', '_blank');
      await expect(openSiteLink).toHaveAttribute('rel', /noopener/);
      await expect(openSiteLink).toHaveAttribute('rel', /noreferrer/);
    });

    await test.step('"Gerar QR Code" abre o dialog com a imagem e permite baixar', async () => {
      await page.getByRole('button', { name: 'Gerar QR Code' }).click();
      await expect(page.getByRole('heading', { name: 'QR Code da sua página' })).toBeVisible();
      const qrImage = page.getByRole('img', { name: 'QR Code da página pública' });
      await expect(qrImage).toBeVisible({ timeout: 10_000 });
      await expect(qrImage).toHaveAttribute('src', /^data:image\//);

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15_000 }),
        page.getByRole('link', { name: 'Baixar QR Code' }).click(),
      ]);
      expect(download.suggestedFilename()).toBe(`${fixture.slug}-${productSlug}.png`);

      // Dois controles respondem por "Fechar": o X do Modal (Radix
      // `Dialog.Close`, sempre presente) e o botão secundário do rodapé —
      // `.last()` mira o do rodapé, a ação secundária desta tarefa.
      await page.getByRole('button', { name: 'Fechar' }).last().click();
      await expect(page.getByRole('heading', { name: 'QR Code da sua página' })).not.toBeVisible();
    });

    await test.step('"Despublicar" abre confirmação; cancelar não despublica', async () => {
      await page.getByRole('button', { name: 'Despublicar', exact: true }).click();
      await expect(page.getByRole('heading', { name: /Despublicar .+\?/ })).toBeVisible();

      await page.getByRole('button', { name: 'Cancelar' }).click();
      await expect(page.getByRole('heading', { name: /Despublicar .+\?/ })).not.toBeVisible();
      await expect(page.getByText('Publicado', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Despublicar', exact: true })).toBeVisible();
    });

    await test.step('confirmar despublica de verdade e a página volta a mostrar "Ver prévia"/"Publicar"', async () => {
      await page.getByRole('button', { name: 'Despublicar', exact: true }).click();
      await page.getByRole('button', { name: 'Despublicar página' }).click();
      await expect(page.getByRole('heading', { name: /Despublicar .+\?/ })).not.toBeVisible();

      await expect(page.getByText('Despublicado', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Ver prévia' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Despublicar', exact: true })).toHaveCount(0);
    });
  });
});
