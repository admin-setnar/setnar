'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Image as ImageIcon, UsersRound, UserRound } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

const destinations = [
  { href: '/app/paginas', label: 'Páginas', icon: FileText },
  { href: '/app/paginas/marketing', label: 'Materiais', icon: ImageIcon },
  { href: '/app/contatos', label: 'Contatos', icon: UsersRound },
  { href: '/app/conta', label: 'Conta', icon: UserRound },
] as const;

export function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  // Longest-matching href wins: `/app/paginas/marketing` starts with
  // `/app/paginas` too, so a naive independent `startsWith` per item would
  // highlight both "Páginas" and "Materiais" at once — nested routes need
  // one active winner, not every ancestor prefix lit up.
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
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast',
              active
                ? 'bg-brand text-brand-contrast'
                : 'text-content-muted hover:bg-surface-sunken hover:text-content',
              mobile && 'justify-center gap-1.5 px-2 sm:gap-2 sm:px-3',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
