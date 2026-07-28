import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/lib/cn';

/**
 * Card
 *
 * Purpose: group related content into a single visual unit.
 * Variants: outlined (default — borders over shadows, per DESIGN_SYSTEM.md),
 * raised (separates a floating layer), sunken (recedes into the page).
 * `interactive` adds hover affordance and should only be used when the whole
 * card is genuinely actionable.
 * Accessibility: renders a plain <div>; make it a <button> or <a> at the call
 * site when it is clickable — never attach a click handler to a bare div.
 */
const cardVariants = cva('rounded-lg', {
  variants: {
    variant: {
      outlined: 'border border-line bg-surface-raised',
      raised: 'border border-line bg-surface-raised shadow-raised',
      sunken: 'bg-surface-sunken',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    },
    interactive: {
      true: 'transition-colors duration-base hover:border-line-strong hover:bg-surface-sunken',
      false: '',
    },
  },
  defaultVariants: { variant: 'outlined', padding: 'md', interactive: false },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, padding, interactive, ...props }: CardProps) {
  return (
    <div className={cn(cardVariants({ variant, padding, interactive }), className)} {...props} />
  );
}

export { cardVariants };
