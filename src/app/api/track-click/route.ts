import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { getAnalyticsGateway } from '@/modules/analytics/infrastructure/analytics-gateway-factory';
import { resolveRepresentativeActivation } from '@/modules/representatives/application/resolve-representative';
import { getRepresentativeRepository } from '@/modules/representatives/infrastructure/representative-repository-factory';
import { getClientIp } from '@/shared/lib/get-client-ip';

/**
 * POST /api/track-click — AN5 (docs/QR_ANALYTICS_PLAN.md §4), the beacon
 * `WhatsappCta` fires on click, `keepalive: true`, without `preventDefault`.
 *
 * Same resolution pattern as `/api/leads/route.ts`: `productSlug` is the
 * only thing trusted from the request body — representative/product ids are
 * never accepted from a caller. This route re-resolves the activation from
 * the request's own `Host` header, exactly like the page itself does, so a
 * caller cannot attribute a click to an arbitrary representative by forging
 * a slug that doesn't belong to the host it's calling from.
 *
 * Always responds `200` — the client never awaits or branches on this
 * response (the `wa.me` navigation already started by the time this
 * returns), so there is nothing for a different status code to communicate.
 * Every failure mode (malformed body, unknown pair, RPC error) is caught and
 * logged, never surfaced.
 */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const productSlug =
      body && typeof body === 'object' ? (body as { productSlug?: unknown }).productSlug : undefined;
    const referrer = body && typeof body === 'object' ? (body as { referrer?: unknown }).referrer : undefined;

    if (typeof productSlug === 'string') {
      const [requestHeaders, clientIp] = await Promise.all([headers(), getClientIp()]);
      const repository = await getRepresentativeRepository();
      const activation = await resolveRepresentativeActivation(
        repository,
        requestHeaders.get('host'),
        productSlug,
      );

      if (activation) {
        const analyticsGateway = await getAnalyticsGateway();
        await analyticsGateway.recordWhatsappClick({
          representativeSlug: activation.representative.slug,
          productSlug: activation.product.slug,
          referrer: typeof referrer === 'string' ? referrer : requestHeaders.get('referer'),
          ip: clientIp,
          userAgent: requestHeaders.get('user-agent'),
        });
      }
    }
  } catch (error) {
    console.error('record_whatsapp_click failed', error);
  }

  return NextResponse.json({ ok: true });
}
