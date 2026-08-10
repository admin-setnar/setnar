import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { after } from 'next/server';

import {
  getAnalyticsGateway,
  reportAnalyticsFailure,
} from '@/modules/analytics/infrastructure/analytics-gateway-factory';
import { LeadForm } from '@/modules/leads/presentation/lead-form';
import { resolveCompanyVertical } from '@/modules/representatives/domain/company-brand/resolve-company-vertical';
import { CONEXAO_CLUB_TABS } from '@/modules/representatives/domain/product-content/conexao-club';
import { AuthorizedRepresentativeIdentificationBlock } from '@/modules/representatives/presentation/authorized-representative-identification-block';
import { resolveCommercialPageMetadata } from '@/modules/representatives/presentation/commercial-page-metadata';
import { ComplianceNotice } from '@/modules/representatives/presentation/compliance-notice';
import { ProductContentTabs } from '@/modules/representatives/presentation/product-content-tabs';
import { resolveCommercialPageActivation } from '@/modules/representatives/presentation/resolve-commercial-page-activation';
import { WhatsappCta } from '@/modules/representatives/presentation/whatsapp-cta';
import { BrandTokensStyle } from '@/modules/tenancy/presentation/brand-tokens';
import { Container } from '@/shared/layout/container';
import { getClientIp } from '@/shared/lib/get-client-ip';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

/**
 * A Representative's public Commercial Page — `<slug>.setnar.com/<productSlug>`
 * (ADR-026 fixes the Host as the Representative; this route resolves the
 * path segment as the Product). Resolution happens here, in the Server
 * Component, the same place `app/layout.tsx` resolves the Company tenant
 * from `headers().get('host')` — not in `middleware.ts`, which ADR-001
 * already rejected for this kind of per-request repository lookup.
 *
 * This is a root-level dynamic segment, so it is a sibling of every static
 * route already under `src/app/` (`entrar/`, `criar-conta/`, `app/`,
 * `termos/`, ...). Next.js's route matcher always prefers a literal static
 * segment over a dynamic one for the same path — proven by reading
 * `node_modules/next/dist/shared/lib/router/utils/sorted-routes.js`'s
 * `_smoosh`, which walks static children before the dynamic `slugName`
 * child — and that matcher has no concept of `Host` at all, so this holds
 * on every host equally, not just `setnar.com`. Two consequences follow:
 * (1) a future product slug that collides with a top-level static route
 * name would be silently shadowed — guarded by
 * `tests/route-collision-guard.test.ts`, not left to be noticed by accident;
 * (2) `/entrar`, `/criar-conta`, `/app`, `/termos`, `/privacidade`,
 * `/esqueci-senha` and `/redefinir-senha` all keep answering on a
 * Representative's own subdomain too (e.g.
 * `joao-silva.setnar.com/entrar` renders SETNAR's own login page) — a
 * conscious gap, not an oversight: nothing reaches those paths from a
 * Representative's published link, and scoping them per-host is a
 * separate product decision for whenever it actually matters.
 *
 * A `null` resolution (bad host, unknown product, or no published
 * activation) always renders the same generic `not-found.tsx` — the
 * anti-enumeration principle already applied to login's error messages
 * (ADR-018): nobody probing subdomains can tell "representative doesn't
 * exist" apart from "product not activated" apart from "not published yet"
 * from the outside. `generateMetadata` below applies the same principle to
 * `<head>`, not only the body — see `resolveCommercialPageMetadata`'s own
 * doc comment for how returning `{}` achieves that for free.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ productSlug: string }>;
}): Promise<Metadata> {
  const [{ productSlug }, requestHeaders] = await Promise.all([params, headers()]);
  const activation = await resolveCommercialPageActivation(requestHeaders.get('host'), productSlug);
  return resolveCommercialPageMetadata(activation);
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productSlug: string }>;
}) {
  const [{ productSlug }, requestHeaders, clientIp] = await Promise.all([
    params,
    headers(),
    getClientIp(),
  ]);

  const activation = await resolveCommercialPageActivation(requestHeaders.get('host'), productSlug);

  if (!activation) {
    notFound();
  }

  const { representative, product } = activation;
  const companyVertical = resolveCompanyVertical(product.companySlug);

  // AN3 (docs/QR_ANALYTICS_PLAN.md §4) — best-effort visit tracking.
  // `after()` runs this once the response has already been sent, so a slow
  // or failing RPC can never delay or break the page a real visitor sees;
  // any error is caught and logged, never rethrown. Only called once
  // resolution above already succeeded — `record_page_visit` re-validates
  // the pair itself, but there is no reason to attempt the call on a path
  // that is already about to 404.
  after(async () => {
    try {
      const analyticsGateway = await getAnalyticsGateway();
      await analyticsGateway.recordPageVisit({
        representativeSlug: representative.slug,
        productSlug: product.slug,
        referrer: requestHeaders.get('referer'),
        ip: clientIp,
        userAgent: requestHeaders.get('user-agent'),
      });
    } catch (error) {
      reportAnalyticsFailure('record_page_visit setup failed', error);
    }
  });

  return (
    <main id="conteudo" data-vertical={companyVertical?.vertical} className="pt-16 pb-20">
      {companyVertical ? (
        <BrandTokensStyle tokens={companyVertical.tokens} scope={companyVertical.vertical} />
      ) : null}
      <Container width="narrow">
        <Text variant="eyebrow">{product.name}</Text>
        <Text as="h1" variant="heading" className="mt-2">
          {product.name}
        </Text>

        <div className="mt-8">
          <AuthorizedRepresentativeIdentificationBlock representative={representative} />
        </div>

        <div className="mt-6">
          <WhatsappCta representative={representative} product={product} />
        </div>

        {product.slug === 'conexao-club' ? (
          <div className="mt-8">
            <ProductContentTabs tabs={CONEXAO_CLUB_TABS} />
          </div>
        ) : null}

        <Card variant="outlined" padding="lg" className="mt-8">
          <Text as="h2" variant="title">
            Prefere que a gente te chame?
          </Text>
          <Text as="p" variant="caption" className="mt-1">
            Deixe seus dados que entramos em contato, sem compromisso.
          </Text>
          <div className="mt-4">
            <LeadForm productSlug={productSlug} />
          </div>
        </Card>

        <ComplianceNotice productSlug={productSlug} />
      </Container>
    </main>
  );
}
