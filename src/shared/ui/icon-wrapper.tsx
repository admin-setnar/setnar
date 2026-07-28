import type { LucideIcon } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/lib/cn';

/**
 * IconWrapper
 *
 * Purpose: render an icon at a consistent size inside a consistent container,
 * so icons never drift in scale or optical weight across the product.
 * Accessibility: always decorative. Icons support labels, they never replace
 * them — the adjacent text carries the meaning.
 */
const wrapperVariants = cva('inline-flex shrink-0 items-center justify-center', {
  variants: {
    variant: {
      plain: 'text-content-muted',
      outlined: 'rounded-md border border-line bg-surface text-content',
      solid: 'rounded-md bg-brand text-brand-contrast',
      subtle: 'rounded-md bg-surface-sunken text-content',
    },
    size: {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
    },
  },
  defaultVariants: { variant: 'outlined', size: 'md' },
});

const ICON_SIZE = { sm: 16, md: 18, lg: 22 } as const;

export interface IconWrapperProps extends VariantProps<typeof wrapperVariants> {
  icon: LucideIcon;
  className?: string;
}

export function IconWrapper({ icon: Icon, variant, size, className }: IconWrapperProps) {
  return (
    <span className={cn(wrapperVariants({ variant, size }), className)}>
      <Icon size={ICON_SIZE[size ?? 'md']} strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
