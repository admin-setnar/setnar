import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/lib/cn';

/**
 * Badge
 *
 * Purpose: label a status or category in as little space as possible.
 * Variants: neutral, brand, success, warning, danger.
 * Accessibility: color never carries the meaning on its own — the text inside
 * the badge always states it.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium leading-5',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-sunken text-content-muted ring-1 ring-inset ring-line',
        brand: 'bg-brand/5 text-brand ring-1 ring-inset ring-brand/15',
        success: 'bg-success-subtle text-success ring-1 ring-inset ring-success/20',
        warning: 'bg-warning-subtle text-warning ring-1 ring-inset ring-warning/20',
        danger: 'bg-danger-subtle text-danger ring-1 ring-inset ring-danger/20',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
