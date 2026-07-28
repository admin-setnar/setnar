import { cn } from '@/shared/lib/cn';

/**
 * Logo
 *
 * Purpose: render the tenant's mark consistently everywhere.
 * The symbol is drawn as inline SVG using `currentColor`, so it inherits the
 * surrounding text color and works on light, dark and inverted surfaces
 * without shipping three image files.
 * Accessibility: decorative by default (`aria-hidden`), because the wordmark
 * next to it is real text. When rendering the symbol alone, pass a `label`.
 * Usage: <Logo variant="horizontal" name={tenant.brand.name} />
 */
export interface LogoProps {
  variant?: 'horizontal' | 'symbol';
  name: string;
  className?: string;
  /** Accessible name. Only needed when the symbol appears without the wordmark. */
  label?: string;
}

export function Logo({ variant = 'horizontal', name, className, label }: LogoProps) {
  if (variant === 'symbol') {
    return <LogoSymbol className={className} label={label ?? name} />;
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5 text-content', className)}>
      <LogoSymbol className="h-[18px] w-auto" />
      <span className="text-[19px] font-semibold leading-none tracking-[-0.03em]">{name}</span>
    </span>
  );
}

/**
 * The mark: two offset bars carving an S out of a solid block, with the
 * chamfered corners from the identity guide.
 */
export function LogoSymbol({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 100 66"
      className={cn('h-4 w-auto', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 0 H96 L100 4 V66 H4 L0 62 Z
           M24 15 H28 V19 H100 V27 H24 Z
           M0 39 H76 V51 H72 V47 H0 Z"
      />
    </svg>
  );
}
