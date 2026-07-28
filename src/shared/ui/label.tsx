'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '@/shared/lib/cn';

/**
 * Label
 *
 * Purpose: name a form control. Every input in SETNAR has one — placeholders
 * are never used as labels.
 * Accessibility: association is by `htmlFor`; clicking the label focuses the
 * control.
 */
export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn('text-sm font-medium leading-none text-content', className)}
      {...props}
    />
  );
});
