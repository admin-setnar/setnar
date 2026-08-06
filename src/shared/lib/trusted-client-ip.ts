import { isIP } from 'node:net';

type HeaderReader = Pick<Headers, 'get'>;

/** Resolve an IP only when Vercel is the trusted edge that supplied it. */
export function getTrustedClientIp(headers: HeaderReader, isVercel: boolean): string | null {
  if (!isVercel) return null;

  for (const name of ['x-vercel-forwarded-for', 'x-forwarded-for']) {
    const firstIp = headers.get(name)?.split(',')[0]?.trim();
    if (firstIp && isIP(firstIp) !== 0) return firstIp;
  }

  return null;
}
