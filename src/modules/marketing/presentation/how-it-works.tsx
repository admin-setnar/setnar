import type { HowItWorksContent } from '@/modules/marketing/domain/marketing-content';
import { resolveIcon } from '@/modules/marketing/presentation/icon-registry';
import { SectionHeading } from '@/modules/marketing/presentation/section-heading';
import { Section } from '@/shared/layout/section';
import { IconWrapper } from '@/shared/ui/icon-wrapper';
import { Reveal } from '@/shared/ui/reveal';
import { Text } from '@/shared/ui/typography';

/**
 * HowItWorks
 *
 * Purpose: remove the "what does this actually involve" objection by showing
 * the whole path in three steps.
 * Structure: the steps are numbered because they genuinely are a sequence —
 * you cannot share a page you have not created. The connecting rule on desktop
 * encodes the same thing.
 */
export function HowItWorks({ id, content }: { id: string; content: HowItWorksContent }) {
  const headingId = `${id}-titulo`;

  return (
    <Section id={id} labelledBy={headingId} bordered>
      <SectionHeading
        id={headingId}
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
      />

      <ol className="mt-14 grid gap-10 sm:mt-16 md:grid-cols-3 md:gap-8">
        {content.steps.map((step, index) => {
          const Icon = resolveIcon(step.icon);
          const isLast = index === content.steps.length - 1;

          return (
            <Reveal as="li" key={step.title} delay={index * 0.06} className="relative">
              <>
                <div className="flex items-center gap-4">
                  <IconWrapper icon={Icon} variant="outlined" size="lg" />
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className="hidden h-px flex-1 bg-line md:block"
                    />
                  ) : null}
                </div>

                <p className="mt-6 font-mono text-xs tracking-[0.14em] text-content-subtle">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <Text as="h3" variant="title" className="mt-2">
                  {step.title}
                </Text>
                <Text variant="body" className="mt-2.5">
                  {step.description}
                </Text>
              </>
            </Reveal>
          );
        })}
      </ol>
    </Section>
  );
}
