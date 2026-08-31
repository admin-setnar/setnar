'use client';

import { useEffect } from 'react';

/**
 * Fallback for `next/link`'s built-in hash-scroll, which only fires
 * reliably for a same-page hash change. A cross-route `Link` (e.g. the
 * trial banner's `/app/conta#assinatura`) lands with the URL and the target
 * id both correct but never scrolls — reproduced manually testing SET-108's
 * trial banner CTA: the first click (a real route navigation) never
 * scrolled, while a second click, already on `/app/conta`, did — because
 * that one is a same-page hash jump the browser handles on its own. Runs
 * once per mount, so it only ever fires on the navigation that actually
 * needs it. No explicit `behavior` — inherits `scroll-behavior` from
 * `globals.css` (smooth by default, `auto` under
 * `prefers-reduced-motion: reduce`), same as the native in-page hash jump
 * this replaces.
 */
export function ScrollToHash({ targetId }: { targetId: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${targetId}`) return;
    document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
  }, [targetId]);

  return null;
}
