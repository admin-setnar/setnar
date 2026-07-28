'use client';

import { useEffect, useState } from 'react';

/**
 * Reports whether the page is scrolled past a threshold.
 *
 * Reads are done inside a rAF callback so the scroll listener never forces a
 * synchronous layout, and state only changes when the boolean flips — not on
 * every scroll event.
 */
export function useScrollThreshold(threshold = 8): boolean {
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    let frame = 0;

    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setPassed(window.scrollY > threshold);
      });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return passed;
}
