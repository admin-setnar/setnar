import 'server-only';

import { headers } from 'next/headers';

import { getTrustedClientIp } from '@/shared/lib/trusted-client-ip';

/**
 * Best-effort client IP for the login rate limiter.
 *
 * Vercel supplies `x-vercel-forwarded-for` and overwrites `x-forwarded-for`
 * at its edge to prevent spoofing. The resolver prefers the Vercel-specific
 * header, accepts the standard fallback only inside a verified Vercel
 * runtime, and returns null everywhere else. Moving hosts therefore fails
 * closed until a new trusted-proxy contract is implemented.
 */
export async function getClientIp(): Promise<string | null> {
  const headerList = await headers();
  return getTrustedClientIp(headerList, process.env.VERCEL === '1');
}
