import type { ElementType, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/lib/cn';

/**
 * Typography
 *
 * Purpose: the only place type sizes, weights and tracking are decided.
 * Hierarchy: display / heading / title / subtitle / body / caption, matching
 * DESIGN_SYSTEM.md. Importance is expressed by scale and weight, never by
 * color alone.
 * Usage: <Text as="h2" variant="heading">Como funciona</Text>
 * Accessibility: `as` controls semantics independently of appearance, so a
 * visually small heading can still be an <h2>.
 */
const textVariants = cva('', {
  variants: {
    variant: {
      display:
        'text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-6xl md:text-[4.25rem]',
      heading: 'text-3xl leading-[1.15] font-semibold tracking-[-0.028em] sm:text-4xl md:text-5xl',
      title: 'text-xl leading-snug font-semibold tracking-[-0.02em] sm:text-2xl',
      subtitle: 'text-lg leading-relaxed font-normal text-content-muted sm:text-xl',
      body: 'text-base leading-relaxed font-normal text-content-muted',
      caption: 'text-sm leading-normal font-normal text-content-subtle',
      eyebrow:
        'text-xs font-semibold uppercase tracking-[0.14em] text-content-subtle',
    },
  },
  defaultVariants: { variant: 'body' },
});

export interface TextProps extends VariantProps<typeof textVariants> {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
}

export function Text({ as, variant, className, children, id }: TextProps) {
  const Component = as ?? defaultElementFor(variant);
  return (
    <Component id={id} className={cn(textVariants({ variant }), className)}>
      {children}
    </Component>
  );
}

function defaultElementFor(variant: TextProps['variant']): ElementType {
  switch (variant) {
    case 'display':
      return 'h1';
    case 'heading':
      return 'h2';
    case 'title':
      return 'h3';
    case 'caption':
    case 'eyebrow':
      return 'span';
    default:
      return 'p';
  }
}

export { textVariants };
