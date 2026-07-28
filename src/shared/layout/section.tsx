import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Container } from '@/shared/layout/container';

/**
 * Section
 *
 * Purpose: vertical rhythm and background tone for a page region, so spacing
 * never gets decided ad hoc inside content components.
 * Accessibility: renders a landmark <section>; pass `labelledBy` pointing at
 * the id of its heading so screen reader users can navigate between regions.
 */
export interface SectionProps {
  id?: string;
  tone?: 'default' | 'sunken' | 'inverted';
  spacing?: 'md' | 'lg';
  bordered?: boolean;
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}

const TONE_CLASS = {
  default: 'bg-surface',
  sunken: 'bg-surface-sunken',
  inverted: 'bg-surface-inverted text-content-inverted',
} as const;

const SPACING_CLASS = {
  md: 'py-16 sm:py-20',
  lg: 'py-20 sm:py-28 lg:py-32',
} as const;

export function Section({
  id,
  tone = 'default',
  spacing = 'lg',
  bordered = false,
  className,
  labelledBy,
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        TONE_CLASS[tone],
        SPACING_CLASS[spacing],
        bordered && 'border-t border-line',
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}
