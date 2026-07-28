'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';

import { AuthTriggerButton } from '@/modules/auth/presentation/auth-trigger-button';
import type { NavigationItem } from '@/modules/marketing/domain/marketing-content';
import { cn } from '@/shared/lib/cn';
import { Container } from '@/shared/layout/container';
import { Logo } from '@/shared/brand/logo';
import { useScrollThreshold } from '@/shared/hooks/use-scroll-threshold';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

/**
 * Navbar
 *
 * Purpose: the page's persistent gateway — identity on the left, orientation
 * in the middle, the two account actions on the right.
 * Behaviour: transparent over the hero, then a glass surface with a hairline
 * border once scrolling starts, so the divide between page and chrome only
 * appears when it is needed.
 * Accessibility: a real <nav> landmark, keyboard reachable throughout, and a
 * mobile menu built on Radix Dialog so focus is trapped and restored. Items
 * whose destination does not exist yet are marked `aria-disabled` and are not
 * links.
 */
export function Navbar({
  brandName,
  items,
}: {
  brandName: string;
  items: readonly NavigationItem[];
}) {
  const scrolled = useScrollThreshold(8);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-base',
        scrolled
          ? 'border-b border-line bg-surface/72 backdrop-blur-xl backdrop-saturate-150'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-6">
          <a
            href="#top"
            className="rounded-sm"
            aria-label={`${brandName} — início`}
          >
            <Logo name={brandName} />
          </a>

          <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <NavLink key={item.label} item={item} />
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <AuthTriggerButton view="sign-in" variant="ghost" size="sm">
              Entrar
            </AuthTriggerButton>
            <AuthTriggerButton view="sign-up" size="sm">
              Criar conta
            </AuthTriggerButton>
          </div>

          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                aria-label="Abrir menu"
                aria-expanded={menuOpen}
              >
                <Menu size={20} aria-hidden="true" />
              </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-surface-inverted/30 data-[state=open]:animate-overlay-in md:hidden" />
              <Dialog.Content
                className={cn(
                  'fixed inset-x-3 top-3 z-50 rounded-lg border border-line bg-surface-raised p-4 shadow-overlay md:hidden',
                  'data-[state=open]:animate-sheet-in',
                )}
              >
                <Dialog.Title className="sr-only">Menu de navegação</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Seções da página e acesso à sua conta.
                </Dialog.Description>

                <div className="flex items-center justify-between">
                  <Logo name={brandName} />
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="sm" aria-label="Fechar menu">
                      <X size={20} aria-hidden="true" />
                    </Button>
                  </Dialog.Close>
                </div>

                <nav aria-label="Principal (celular)" className="mt-4 flex flex-col">
                  {items.map((item) => (
                    <MobileNavLink key={item.label} item={item} onNavigate={() => setMenuOpen(false)} />
                  ))}
                </nav>

                <div className="mt-4 grid gap-2 border-t border-line pt-4">
                  <AuthTriggerButton
                    view="sign-in"
                    variant="secondary"
                    fullWidth
                    onClickCapture={() => setMenuOpen(false)}
                  >
                    Entrar
                  </AuthTriggerButton>
                  <AuthTriggerButton
                    view="sign-up"
                    fullWidth
                    onClickCapture={() => setMenuOpen(false)}
                  >
                    Criar conta
                  </AuthTriggerButton>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </Container>
    </header>
  );
}

function NavLink({ item }: { item: NavigationItem }) {
  const className =
    'rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast';

  if (item.placeholder) {
    return (
      <span
        aria-disabled="true"
        title="Em breve"
        className={cn(className, 'cursor-default text-content-subtle')}
      >
        {item.label}
      </span>
    );
  }

  return (
    <a href={item.href} className={cn(className, 'text-content-muted hover:bg-surface-sunken hover:text-content')}>
      {item.label}
    </a>
  );
}

function MobileNavLink({ item, onNavigate }: { item: NavigationItem; onNavigate: () => void }) {
  if (item.placeholder) {
    return (
      <span
        aria-disabled="true"
        className="flex items-center justify-between rounded-md px-2 py-3 text-[15px] text-content-subtle"
      >
        {item.label}
        <Badge>Em breve</Badge>
      </span>
    );
  }

  return (
    <a
      href={item.href}
      onClick={onNavigate}
      className="rounded-md px-2 py-3 text-[15px] font-medium text-content transition-colors duration-fast hover:bg-surface-sunken"
    >
      {item.label}
    </a>
  );
}
