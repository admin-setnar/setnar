import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { after } from 'next/server';

import {
  getAnalyticsGateway,
  reportAnalyticsFailure,
} from '@/modules/analytics/infrastructure/analytics-gateway-factory';
import { DispatchCommercialPage } from '@/modules/representatives/presentation/commercial-pages/dispatch-commercial-page';
import { resolveCommercialPageMetadata } from '@/modules/representatives/presentation/commercial-page-metadata';
import { resolveCommercialPresence } from '@/modules/representatives/presentation/resolve-commercial-presence';
import { getRepresentativeRepository } from '@/modules/representatives/infrastructure/representative-repository-factory';
import { getClientIp } from '@/shared/lib/get-client-ip';

/**
 * A Representative's public Commercial Page —
 * `<representative-slug>.<company-slug>.setnar.com/<productSlug>` (ADR-026
 * fixes the Host as identifying the Representative and, since the Company
 * joined the public address, the Company that authorizes them too — see
 * `resolveCommercialPresence`/`parseCommercialPresenceHost` for the current
 * two-label contract; this route resolves the path segment as the Product).
 * Resolution happens here, in the Server
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
 * `joao-silva.igreen.setnar.com/entrar` renders SETNAR's own login page) —
 * a conscious gap, not an oversight: nothing reaches those paths from a
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
  const activation = await resolveCommercialPresence(requestHeaders.get('host'), productSlug);
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

  const activation = await resolveCommercialPresence(requestHeaders.get('host'), productSlug);

  if (!activation) {
    notFound();
  }

  const { representative, product } = activation;

  // Started here, before after() schedules — not awaited yet. Next.js
  // forbids reading `cookies()` for the first time inside an `after()`
  // callback (throws "used \"cookies\" inside \"after(...)\""), and
  // `getRepresentativeRepository()` reads it as its very first statement
  // (`createClient()` → `await cookies()`), synchronously, the moment this
  // function is invoked — so kicking it off out here satisfies that
  // requirement while `after()` still does the actual awaiting, keeping
  // this off the response path.
  const representativeRepositoryPromise = getRepresentativeRepository();

  // AN3 (docs/QR_ANALYTICS_PLAN.md §4) — best-effort visit tracking.
  // `after()` runs this once the response has already been sent, so a slow
  // or failing RPC can never delay or break the page a real visitor sees;
  // any error is caught and logged, never rethrown. Only called once
  // resolution above already succeeded — `record_page_visit` re-validates
  // the pair itself, but there is no reason to attempt the call on a path
  // that is already about to 404.
  //
  // Owner-view exclusion (docs/plans/MVP_ANALYTICS_AUDIT.md §7, P1 #2):
  // `record_page_visit` runs through the service-role Analytics client
  // (`analytics-write-client.ts`), which carries no session, so it has no
  // way to know the visitor is the page's own owner. That check has to
  // happen here instead, against the request's own cookies, before the RPC
  // is ever called — `isViewerOwner` is the only place left in the request
  // where that identity is still available (`analytics_events` itself has
  // none). A representative checking their own live page is simply not
  // recorded, same as a detected bot (`is_bot_user_agent`) — not tagged,
  // not counted against the rate limit, because the RPC is never invoked.
  after(async () => {
    try {
      const repository = await representativeRepositoryPromise;
      if (await repository.isViewerOwner(representative.id)) return;

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

  return <DispatchCommercialPage representative={representative} product={product} productSlug={productSlug} />;
}
