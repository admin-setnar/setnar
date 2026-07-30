import type { NextRequest } from 'next/server';

import { updateSession } from '@/shared/lib/supabase/middleware';

/**
 * Refreshes a near-expiry Supabase session before a page renders.
 *
 * SOLELY does that — it does not decide what counts as a protected route
 * (that is `/app/page.tsx`'s own `redirect()`, deliberately kept out of
 * middleware). Splitting the two means a route can be added or removed from
 * "protected" without touching the one thing every request already pays the
 * cost of running.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/**
 * Excludes static assets, `_next/*` and image/icon files — the same cost
 * concern ADR-001 already raised against putting *tenant* resolution in
 * middleware ("runs on every asset request for no gain"). A session-refresh
 * check is cheap compared to that, but still pointless work against a CSS
 * bundle or a favicon that never reads a cookie, so the same exclusion
 * applies here for the same reason.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
