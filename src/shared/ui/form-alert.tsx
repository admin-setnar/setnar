import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

/**
 * FormAlert
 *
 * Purpose: report the outcome of a submitted form (the failure or success the
 * user cannot see from the fields alone).
 * Accessibility: `role="alert"` for errors so assistive technology announces
 * them immediately; success uses `role="status"` to avoid interrupting.
 * Copy rule: errors state what happened and how to recover. They never expose
 * technical detail and never apologise.
 */
export interface FormAlertProps {
  id?: string;
  tone: 'error' | 'success';
  title: string;
  description?: string;
  className?: string;
}

export function FormAlert({ id, tone, title, description, className }: FormAlertProps) {
  const isError = tone === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      id={id}
      role={isError ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-md border p-3 text-sm',
        isError
          ? 'border-danger/20 bg-danger-subtle text-danger'
          : 'border-success/20 bg-success-subtle text-success',
        className,
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="font-medium">{title}</p>
        {description ? <p className="opacity-90">{description}</p> : null}
      </div>
    </div>
  );
}
