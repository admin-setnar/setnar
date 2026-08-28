import type { BenefitsContent } from '@/modules/marketing/domain/marketing-content';
import { resolveIcon } from '@/modules/marketing/presentation/icon-registry';
import { SectionHeading } from '@/modules/marketing/presentation/section-heading';
import { Section } from '@/shared/layout/section';
import { Card } from '@/shared/ui/card';
import { IconWrapper } from '@/shared/ui/icon-wrapper';
import { Reveal } from '@/shared/ui/reveal';
import { Text } from '@/shared/ui/typography';

/**
 * Benefits
 *
 * Purpose: state what the product gives back, in the user's words rather than
 * feature names.
 * Layout: an asymmetric grid — the first card spans two columns on desktop so
 * the section does not read as five identical tiles. The order matches the
 * order the benefits are felt in.
 */
export function Benefits({ id, content }: { id: string; content: BenefitsContent }) {
  const headingId = `${id}-titulo`;

  return (
    <Section id={id} labelledBy={headingId} tone="sunken" bordered>
      <SectionHeading
        id={headingId}
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
      />

      <ul className="mt-14 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {content.items.map((benefit, index) => {
          const Icon = resolveIcon(benefit.icon);
          return (
            <Reveal
              as="li"
              key={benefit.title}
              delay={index * 0.04}
              className={index === 0 ? 'sm:col-span-2' : undefined}
            >
              <Card padding="lg" interactive className="h-full">
                <IconWrapper icon={Icon} variant="subtle" />
                <Text as="h3" variant="title" className="mt-5 text-lg">
                  {benefit.title}
                </Text>
                <Text variant="body" className="mt-2 text-[15px]">
                  {benefit.description}
                </Text>
              </Card>
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}
