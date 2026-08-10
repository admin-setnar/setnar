'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * Input
 *
 * Purpose: single-line text entry.
 * States: default, hover, focus, disabled, invalid.
 * Accessibility: `invalid` sets `aria-invalid`; the description and error text
 * are wired by FormField through `aria-describedby`. Never use a placeholder
 * as the label.
 * Usage: prefer <FormField> — it composes Label + Input + messages correctly.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Rendered inside the field, before the text. Decorative only. */
  leading?: ReactNode;
  /** Rendered inside the field, after the text. Use for controls (e.g. reveal password). */
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, leading, trailing, disabled, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        'flex h-11 items-center gap-2 rounded-md border bg-surface px-3',
        'transition-[border-color,box-shadow] duration-fast',
        'focus-within:ring-2 focus-within:ring-offset-2',
        invalid ? 'border-danger' : 'border-line hover:border-line-strong',
        disabled && 'cursor-not-allowed bg-surface-sunken opacity-60',
        className,
      )}
      style={
        invalid
          ? ({ ['--tw-ring-color' as string]: 'rgb(var(--danger) / 0.45)' } as React.CSSProperties)
          : undefined
      }
    >
      {leading ? (
        <span className="text-content-subtle" aria-hidden="true">
          {leading}
        </span>
      ) : null}
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'peer h-full w-full bg-transparent text-base text-content outline-none',
          'placeholder:text-content-subtle disabled:cursor-not-allowed',
        )}
        {...props}
      />
      {trailing}
    </div>
  );
});
