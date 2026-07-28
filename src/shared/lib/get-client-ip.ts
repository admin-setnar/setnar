import 'server-only';

import { headers } from 'next/headers';

/**
 * Best-effort client IP for the login rate limiter.
 *
 * Trusting the first address in `x-forwarded-for` is safe specifically
 * because this app deploys on Vercel: the platform overwrites the header at
 * its edge and never forwards a client-supplied value through, so what
 * reaches us here cannot be spoofed by the request itself. On most other
 * hosts (a generic reverse proxy, self-hosted Nginx) the header is appended
 * to, not replaced — a client can prepend a fake address and the "first" IP
 * read here would be the attacker's forgery, not the real origin. If SETNAR
 * ever moves off Vercel, this function must be revisited before the rate
 * limiter can be trusted again.
 */
export async function getClientIp(): Promise<string | null> {
  const headerList = await headers();
  const forwardedFor = headerList.get('x-forwarded-for');
  const firstIp = forwardedFor?.split(',')[0]?.trim();
  return firstIp || null;
}
