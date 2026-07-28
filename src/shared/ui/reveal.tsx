'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * Reveal
 *
 * Purpose: one restrained scroll-in transition shared by every section, so no
 * section invents its own animation.
 * Motion: a 6px rise plus fade over 300ms — the ceiling set in
 * DESIGN_SYSTEM.md. Plays once; the observer disconnects after firing.
 * Accessibility: `as` exists so this wrapper never breaks the semantics of the
 * element it wraps. Inside a list it must render the <li> itself — a <div>
 * between <ul> and <li> makes the list stop being a list for screen readers.
 * Under `prefers-reduced-motion` the content renders in its final state with no
 * transition and no offset.
 * Implementation note: built on IntersectionObserver rather than an animation
 * library. See ADR-005 in the README.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: ElementType;
}) {
  const Component = as ?? 'div';
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: '-64px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Component
      ref={ref}
      className={cn(
        'transition-[opacity,transform] duration-slow ease-out',
        'motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
        className,
      )}
      style={{ transitionDelay: delay ? `${delay}s` : undefined }}
    >
      {children}
    </Component>
  );
}
