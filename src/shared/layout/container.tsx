import type { ElementType, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * Container
 *
 * Purpose: own horizontal rhythm — max width and gutters — in exactly one
 * place, so no section invents its own padding.
 * Widths: content (default, 1200px) and narrow (prose measure, for centred
 * copy blocks).
 */
export interface ContainerProps {
  as?: ElementType;
  width?: 'content' | 'narrow';
  className?: string;
  children: ReactNode;
}

export function Container({ as, width = 'content', className, children }: ContainerProps) {
  const Component = as ?? 'div';
  return (
    <Component
      className={cn(
        'mx-auto w-full px-6 sm:px-8',
        width === 'content' ? 'max-w-container' : 'max-w-3xl',
        className,
      )}
    >
      {children}
    </Component>
  );
}
