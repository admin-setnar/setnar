'use client';

import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

/**
 * Modal
 *
 * Purpose: interrupt the page for a short, self-contained task (sign in, sign
 * up). Per DESIGN_SYSTEM.md, modals are used sparingly — never for
 * notifications or content that belongs on a page.
 * Accessibility: focus is trapped and restored, Escape closes, the backdrop is
 * inert to screen readers, and the dialog is labelled by its title and
 * described by its description. All of this comes from Radix Dialog and must
 * not be re-implemented.
 * Motion: fades and a 8px rise, under the 300ms ceiling; disabled entirely
 * under `prefers-reduced-motion`.
 * Responsive: full-width sheet with safe padding on mobile, centred card from
 * `sm` upwards.
 */
export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Visually hides the header text while keeping it for assistive technology. */
  hideHeader?: boolean;
  className?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  hideHeader = false,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-surface-inverted/40 backdrop-blur-[2px]',
            'data-[state=open]:animate-overlay-in',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2',
            'max-h-[calc(100dvh-2rem)] overflow-y-auto',
            'rounded-xl border border-line bg-surface-raised p-6 shadow-overlay sm:p-8',
            'data-[state=open]:animate-content-in data-[state=closed]:animate-content-out',
            className,
          )}
        >
          <div className={cn('mb-6 pr-8', hideHeader && 'sr-only')}>
            <Dialog.Title className="text-xl font-semibold tracking-[-0.02em] text-content">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-1.5 text-sm leading-relaxed text-content-muted">
                {description}
              </Dialog.Description>
            ) : null}
          </div>

          <Dialog.Close
            aria-label="Fechar"
            className={cn(
              'absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md',
              'text-content-subtle transition-colors duration-fast hover:bg-surface-sunken hover:text-content',
            )}
          >
            <X size={18} aria-hidden="true" />
          </Dialog.Close>

          {children}

          {footer ? <div className="mt-6 border-t border-line pt-5">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
