import { LAUNCH_PRICE_LABEL } from '@/modules/billing/domain/billing-rules';
import type { PricingContent } from '@/modules/marketing/domain/marketing-content';
import { SectionHeading } from '@/modules/marketing/presentation/section-heading';
import { Section } from '@/shared/layout/section';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

/**
 * Pricing
 *
 * Purpose: state the one plan and its real conditions instead of leaving
 * "Preços" as a dead nav link. A single centered card, not a comparison
 * grid — there is only one plan, so a grid would invent a choice that
 * doesn't exist.
 * Price source: `LAUNCH_PRICE_LABEL` (billing domain) — the same constant
 * the authenticated checkout button already renders. One source of truth,
 * so the SET-31 fix (real `amount_cents` instead of this marketing label)
 * corrects this section for free when it lands.
 */
export function Pricing({ id, content }: { id: string; content: PricingContent }) {
  const headingId = `${id}-titulo`;

  return (
    <Section id={id} labelledBy={headingId} bordered>
      <SectionHeading
        id={headingId}
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
      />

      <Card
        variant="raised"
        padding="lg"
        className="mx-auto mt-14 max-w-sm text-center sm:mt-16"
      >
        <Text variant="eyebrow">Plano único</Text>
        <Text as="p" variant="heading" className="mt-3 text-4xl">
          {LAUNCH_PRICE_LABEL}
        </Text>
        <Text variant="caption" className="mt-2">
          {content.priceQualifier}
        </Text>
        <Text variant="body" className="mt-6 font-medium text-content">
          {content.trialNote}
        </Text>
      </Card>
    </Section>
  );
}
