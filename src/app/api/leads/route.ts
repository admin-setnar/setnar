import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { formatPhoneToE164, LEAD_HONEYPOT_FIELD } from '@/modules/leads/domain/lead-rules';
import { getLeadGateway } from '@/modules/leads/infrastructure/lead-gateway-factory';
import { leadSubmissionSchema } from '@/modules/leads/presentation/schemas/lead.schema';
import { resolveRepresentativeActivation } from '@/modules/representatives/application/resolve-representative';
import { getRepresentativeRepository } from '@/modules/representatives/infrastructure/representative-repository-factory';
import { getClientIp } from '@/shared/lib/get-client-ip';

/**
 * POST /api/leads — the "API route com rate limiting" the RLS design note
 * on `leads` (`supabase/migrations/20260731000000_create_representative_domain.sql`)
 * already promised in place of a direct browser INSERT. Called by
 * `LeadForm` (`modules/leads/presentation/lead-form.tsx`) from any published
 * Commercial Page.
 *
 * `representativeId`/`productId` are NEVER read from the request body —
 * only `productSlug` is, the same non-sensitive path segment
 * `[productSlug]/page.tsx` already resolves. This route re-runs the exact
 * same `resolveRepresentativeActivation(repository, host, productSlug)` the
 * page itself uses, from the request's own `Host` header, so a caller
 * cannot attribute a lead to an arbitrary representative by forging an ID
 * in the body — the only thing trusted from the client is which page it
 * claims to be submitting from, and that claim is re-verified against the
 * same public, RLS-scoped data the page rendered from.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || typeof (body as { productSlug?: unknown }).productSlug !== 'string') {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = leadSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Honeypot tripped: respond exactly like a real success (see
  // resolveRepresentativeActivation's own anti-enumeration note, ADR-030)
  // so a bot gets no signal it was caught, and never touch submit_lead.
  if (parsed.data[LEAD_HONEYPOT_FIELD]) {
    return NextResponse.json({ ok: true });
  }

  const { productSlug, origem } = body as { productSlug: string; origem?: unknown };

  const [requestHeaders, clientIp] = await Promise.all([headers(), getClientIp()]);
  const repository = await getRepresentativeRepository();
  const activation = await resolveRepresentativeActivation(
    repository,
    requestHeaders.get('host'),
    productSlug,
  );

  if (!activation) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const leadGateway = await getLeadGateway();
  const result = await leadGateway.submitLead({
    representativeId: activation.representative.id,
    productId: activation.product.id,
    telefoneE164: formatPhoneToE164(parsed.data.telefone),
    nome: parsed.data.nome,
    cidade: parsed.data.cidade || null,
    email: parsed.data.email || null,
    origem: typeof origem === 'string' ? origem : null,
    referrer: requestHeaders.get('referer'),
    ip: clientIp,
  });

  if (result === 'submitted') {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: result === 'rejected' ? 429 : 500 });
}
