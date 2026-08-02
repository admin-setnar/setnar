import type { Representative } from '@/modules/representatives/domain/representative';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

/**
 * RepresentativeHubPlaceholder
 *
 * Purpose: D3.B.5's proof that `/app` renders a different state once a
 * signed-in User has a Representative — NOT the real hub. The real hub (D5:
 * activated products, the public link/QR Code, the lead list) is a
 * dedicated, later step; this component exists only so `/app`'s two-state
 * branch has something real to render on the "has a Representative" side.
 *
 * Server Component on purpose — no `'use client'`: nothing here is
 * interactive yet.
 *
 * Does not compose the public URL (`<slug>.setnar.com`) — same decision
 * already recorded on `OnboardingForm` (D3.B.4): nothing in
 * `TenantClientView`/`useTenant()` exposes the root hostname today, and
 * adding that just for this placeholder would be scope beyond what D3.B.5
 * asks for. D5's real hub is where that link renders for real.
 */
export function RepresentativeHubPlaceholder({ representative }: { representative: Representative }) {
  return (
    <Card variant="raised" padding="lg" className="mt-8 space-y-1">
      <Text as="h2" variant="title">
        {representative.name}
      </Text>
      <Text as="p" variant="body">
        Sua página: <strong className="text-content">{representative.slug}</strong> — mais recursos
        chegam em breve.
      </Text>
    </Card>
  );
}
