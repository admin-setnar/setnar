import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { LogoutButton } from '@/modules/auth/presentation/logout-button';
import { Card } from '@/shared/ui/card';
import { Container } from '@/shared/layout/container';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Sua conta', robots: { index: false, follow: false } };

/**
 * `/app` — Sprint B's one protected route.
 *
 * Content is deliberately minimal: the authenticated user's name/e-mail and
 * a way to sign out. No catalogue, no product pages, no dashboard — that is
 * Stage 1 roadmap, out of scope here. This page exists to prove the
 * middleware-refreshed session + redirect-with-`?next=` flow end to end,
 * not to ship the authenticated product surface.
 *
 * No session → `redirect('/entrar?next=/app')`, the real path of this
 * route, not a literal duplicated elsewhere — if this route ever moves, the
 * redirect target moves with it automatically.
 */
export default async function AppHomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/entrar?next=/app');
  }

  return (
    <main id="conteudo" className="pt-16 pb-20">
      <Container width="narrow">
        <Text as="h1" variant="heading">
          Sua conta
        </Text>

        <Card variant="raised" padding="lg" className="mt-8 space-y-1">
          <Text as="p" variant="body">
            <strong className="text-content">{user.name}</strong>
          </Text>
          <Text as="p" variant="caption">
            {user.email}
          </Text>
        </Card>

        <div className="mt-6">
          <LogoutButton />
        </div>
      </Container>
    </main>
  );
}
