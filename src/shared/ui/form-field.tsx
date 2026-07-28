'use client';

import { useId, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

import { cn } from '@/shared/lib/cn';
import { Label } from '@/shared/ui/label';

/**
 * FormField
 *
 * Purpose: guarantee that every control in SETNAR ships with a real label, a
 * described-by hint and a recoverable error message — without each form
 * re-implementing the wiring.
 * Usage:
 *   <FormField label="E-mail" error={errors.email?.message}>
 *     {({ id, describedBy, invalid }) => (
 *       <Input id={id} aria-describedby={describedBy} invalid={invalid} {...register('email')} />
 *     )}
 *   </FormField>
 * Accessibility: the error is announced politely and referenced through
 * `aria-describedby`; the message explains how to recover, never just "invalid".
 * Known limitation: renders exactly one control per field by design.
 */
export interface FormFieldRenderProps {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

export interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Hides the label visually while keeping it available to screen readers. */
  hideLabel?: boolean;
  className?: string;
  children: (props: FormFieldRenderProps) => ReactNode;
  /** Rendered on the label row, aligned right (e.g. "Esqueci minha senha"). */
  action?: ReactNode;
}

export function FormField({
  label,
  hint,
  error,
  hideLabel = false,
  className,
  children,
  action,
}: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
          {label}
        </Label>
        {action}
      </div>

      {children({ id, describedBy, invalid })}

      {hint && !error ? (
        <p id={hintId} className="text-xs text-content-subtle">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-danger"
        >
          <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
