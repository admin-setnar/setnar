import { BadgeCheck } from 'lucide-react';

import type { Representative } from '@/modules/representatives/domain/representative';
import { Card } from '@/shared/ui/card';
import { IconWrapper } from '@/shared/ui/icon-wrapper';
import { Text } from '@/shared/ui/typography';

/**
 * "Quem vai te atender" — identifies the licensed human being behind a
 * Commercial Page, never a generic "seller" placeholder. Copy ("Licenciado
 * Autorizado iGreen Energy · ID {id}") is ported verbatim from the
 * compliance-signed-off wording in
 * `templates/commercial-pages/ConexaoGreen/index.html` (`{{REP_NOME}}`,
 * `{{REP_ID}}`), not reinvented — see
 * `templates/commercial-pages/README.md` on why that file is the source of
 * truth for this exact block.
 *
 * Deliberately its own component, not inlined into the page: this is the
 * one piece of the Commercial Page every product template repeats
 * (`grep -rn "Quem vai te atender" templates/commercial-pages/`), so it is
 * meant to move into the shared product layout once more than one product
 * page exists, unchanged.
 */
export function LicenseeIdentificationBlock({
  representative,
}: {
  representative: Representative;
}) {
  return (
    <Card variant="outlined" padding="lg" className="flex items-start gap-4">
      <IconWrapper icon={BadgeCheck} variant="solid" size="lg" />
      <div>
        <Text as="p" variant="eyebrow">
          Quem vai te atender
        </Text>
        <Text as="h2" variant="title" className="mt-1">
          {representative.name}
        </Text>
        <Text as="p" variant="caption" className="mt-1">
          Licenciado Autorizado iGreen Energy · ID {representative.licenseId}
        </Text>
        {representative.city ? (
          <Text as="p" variant="caption">
            {representative.city}
          </Text>
        ) : null}
        {representative.phone ? (
          <Text as="p" variant="caption">
            {representative.phone}
          </Text>
        ) : null}
      </div>
    </Card>
  );
}
