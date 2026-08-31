'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Share2, UsersRound, UserRound } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

const destinations = [
  { href: '/app/paginas', label: 'Páginas', icon: FileText },
  { href: '/app/divulgacao', label: 'Divulgação', icon: Share2 },
  { href: '/app/contatos', label: 'Contatos', icon: UsersRound },
  { href: '/app/conta', label: 'Conta', icon: UserRound },
] as const;

export function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  // Longest-matching href wins: defensive even though no nested destination
  // collides today (Materiais, the original reason this existed, was
  // absorbed into `/app/divulgacao/biblioteca` — ADR-094). Keeps highlighting
  // correct for any single nested destination without re-litigating this
  // logic if one is added again.
  const activeHref = destinations
    .map((d) => d.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav aria-label="Navegação da conta" className={cn(mobile ? 'grid grid-cols-4 gap-1 sm:gap-2' : 'space-y-1')}>
      {destinations.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            aria-label={mobile ? label : undefined}
            className={cn(
              'flex min-h-11 min-w-0 items-center rounded-md font-medium transition-colors duration-fast',
              active
                ? 'bg-brand text-brand-contrast'
                : 'text-content-muted hover:bg-surface-sunken hover:text-content',
              mobile
                ? 'flex-col justify-center gap-1 px-1 py-1.5 text-[11px] sm:flex-row sm:gap-2 sm:px-3 sm:py-2 sm:text-sm'
                : 'justify-start gap-3 px-3 py-2 text-sm',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span
              className={cn(
                'max-w-full break-words text-center leading-tight',
                mobile ? 'max-[387px]:hidden' : undefined,
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
