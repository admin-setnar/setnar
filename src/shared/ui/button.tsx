'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/lib/cn';
import { Spinner } from '@/shared/ui/spinner';

/**
 * Button
 *
 * Purpose: the single control used for every action in the product.
 * Variants: primary (main action), secondary (alternative), ghost (low
 * emphasis), danger (destructive). No other variants may be added without a
 * matching entry in DESIGN_SYSTEM.md.
 * States: default, hover, active, focus-visible, disabled, loading.
 * Accessibility: renders a real <button>; `loading` sets `aria-busy` and
 * blocks interaction without removing the element from the tab order context.
 * Usage: <Button variant="primary" size="lg" loading={isSubmitting}>Entrar</Button>
 * Composition: `asChild` renders the styles onto a child (e.g. a Next <Link>).
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-medium leading-none tracking-[-0.01em]',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-fast',
    'active:translate-y-px',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-contrast hover:bg-brand-hover active:bg-brand-active shadow-subtle',
        secondary:
          'border border-line bg-surface text-content hover:border-line-strong hover:bg-surface-sunken',
        ghost: 'text-content-muted hover:bg-surface-sunken hover:text-content',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: {
        sm: 'h-9 rounded-md px-3 text-sm',
        md: 'h-11 rounded-md px-4 text-[15px]',
        lg: 'h-12 rounded-lg px-6 text-base',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, asChild = false, loading = false, children, disabled, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* Slot requires exactly one child, and `{null}{children}` is already an
          array of two. When composing, this component renders nothing of its
          own — the consumer's element is the whole child. */}
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner /> : null}
          {children}
        </>
      )}
    </Component>
  );
});

export { buttonVariants };
