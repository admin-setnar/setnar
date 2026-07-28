import { cn } from '@/shared/lib/cn';

/**
 * BrandRule
 *
 * Purpose: the identity's "elemento gráfico" — staggered rules that fade out
 * to the right — used as a structural marker instead of decorative flourish.
 * It appears above section headings and inside the product preview, tying the
 * page to the mark (which is itself built from offset bars).
 * Accessibility: purely presentational.
 * Known limitation: intentionally has no variants; if it needs one, question
 * whether the decoration is earning its place.
 */
const LINES = [
  { width: 'w-16', indent: 'ml-0' },
  { width: 'w-10', indent: 'ml-3' },
  { width: 'w-14', indent: 'ml-1.5' },
] as const;

export function BrandRule({ className }: { className?: string }) {
  return (
    <span className={cn('flex flex-col gap-[3px]', className)} aria-hidden="true">
      {LINES.map((line) => (
        <span
          key={line.width + line.indent}
          className={cn('brand-rule h-[3px] rounded-[1px]', line.width, line.indent)}
        />
      ))}
    </span>
  );
}
