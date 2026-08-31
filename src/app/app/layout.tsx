import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AppNavigation } from '@/app/app/app-navigation';
import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { TrialBannerSlot } from '@/modules/billing/presentation/trial-banner-slot';
import { Logo } from '@/shared/brand/logo';

export const metadata: Metadata = {
  title: { default: 'Páginas', template: '%s | SETNAR' },
  robots: { index: false, follow: false },
};

export default async function AuthenticatedAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/app');

  return (
    <div className="min-h-screen bg-surface-sunken md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <div className="md:col-span-2">
        <TrialBannerSlot />
      </div>
      <aside className="hidden border-r border-line bg-surface-raised md:flex md:min-h-screen md:flex-col md:p-5">
        <Logo name="SETNAR" className="px-2 py-3" />
        <div className="mt-8 flex-1">
          <AppNavigation />
        </div>
        <div className="border-t border-line px-2 pt-4">
          <p className="truncate text-sm font-medium text-content">{user.name}</p>
          <p className="truncate text-xs text-content-subtle">{user.email}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-line bg-surface-raised px-4 py-3 md:hidden">
          <div className="mx-auto max-w-5xl space-y-3">
            <Logo name="SETNAR" />
            <AppNavigation mobile />
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
