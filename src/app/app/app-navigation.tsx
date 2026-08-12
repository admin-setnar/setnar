'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, UsersRound, UserRound } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

const destinations = [
  { href: '/app/paginas', label: 'Páginas', icon: FileText },
  { href: '/app/contatos', label: 'Contatos', icon: UsersRound },
  { href: '/app/conta', label: 'Conta', icon: UserRound },
] as const;

export function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação da conta" className={cn(mobile ? 'grid grid-cols-3 gap-1 sm:gap-2' : 'space-y-1')}>
      {destinations.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
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
