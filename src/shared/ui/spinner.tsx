import { cn } from '@/shared/lib/cn';

/**
 * Spinner
 *
 * Purpose: indicate an in-flight action inside a control that is too small for
 * a skeleton (buttons, inline states).
 * Accessibility: purely decorative — the surrounding control owns `aria-busy`
 * and the accessible status text.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 animate-spin', className)}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
