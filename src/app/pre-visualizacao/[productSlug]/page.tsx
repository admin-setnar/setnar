import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { getRepresentativeRepository } from '@/modules/representatives/infrastructure/representative-repository-factory';
import { DispatchCommercialPage } from '@/modules/representatives/presentation/commercial-pages/dispatch-commercial-page';
import { STATE_BADGE } from '@/modules/representatives/presentation/activation-view-state';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = {
  title: 'Prévia privada',
  // Never indexed, never followed — this is the owner's own eyes-only view
  // of a page that may not even be published yet.
  robots: { index: false, follow: false },
};

/**
 * SET-36 — the private preview: configure → visualize → conferir → publicar,
 * without ever publishing publicly to check the result. A root-level route
 * (sibling of `[productSlug]/`, not nested under `src/app/app/`) on purpose:
 * `src/app/app/layout.tsx` wraps every route beneath it in the authenticated
 * app shell (a permanent sidebar on desktop), which would make the preview's
 * own width/breakpoints diverge from what a real visitor sees — the exact
 * opposite of this issue's "conteúdo e responsividade correspondem à página
 * final" acceptance criterion. This route does its own auth check instead
 * (mirroring `AuthenticatedAppLayout`'s own `redirect`), and renders
 * `DispatchCommercialPage` — the same dispatcher `[productSlug]/page.tsx`
 * renders — under nothing but its own thin preview banner.
 *
 * Authorization: `findOwnActivation` resolves by the caller's own
 * `profile_id`, scoped by `product_activations_select_own` RLS
 * (`supabase/migrations/20260805000000_fix_rls_policy_cycle.sql:180-184`),
 * in any status — `draft`/`unpublished`/`published` all resolve here, unlike
 * the public route's `published`-only resolution. No write ever happens on
 * this route: nothing here can move `product_activations.status` or touch
 * `published_at`, so simply viewing a preview can never side-effect the real
 * page.
 */
export default async function CommercialPagePreviewPage({
  params,
}: {
  params: Promise<{ productSlug: string }>;
}) {
  const { productSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=/pre-visualizacao/${productSlug}`);

  const activation = await (await getRepresentativeRepository()).findOwnActivation(user.id, productSlug);

  if (!activation) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-16 sm:px-6">
        <Card variant="raised" padding="lg" className="space-y-3">
          <Text as="h1" variant="heading">Nada para mostrar aqui ainda</Text>
          <Text as="p" variant="body">
            Você ainda não ativou este produto, ou o link está incorreto. Ative-o em &quot;Minhas
            páginas&quot; para conseguir ver a prévia.
          </Text>
          <Button asChild variant="primary">
            <Link href="/app/paginas">Ir para minhas páginas</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const { representative, product, status } = activation;
  const badge = STATE_BADGE[status];

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-line bg-surface-raised">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Text as="p" variant="caption" className="font-medium text-content">
              Prévia privada — só você vê esta página assim.
            </Text>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href="/app/paginas">Voltar para minhas páginas</Link>
          </Button>
        </div>
      </div>

      <DispatchCommercialPage
        representative={representative}
        product={product}
        productSlug={productSlug}
        leadFormDisabled
      />
    </div>
  );
}
