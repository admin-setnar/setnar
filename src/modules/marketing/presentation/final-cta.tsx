import { AuthTriggerButton } from '@/modules/auth/presentation/auth-trigger-button';
import type { CallToActionContent } from '@/modules/marketing/domain/marketing-content';
import { Section } from '@/shared/layout/section';
import { LogoSymbol } from '@/shared/brand/logo';
import { Text } from '@/shared/ui/typography';

/**
 * FinalCta
 *
 * Purpose: give the reader who scrolled the whole page a decision point
 * without making them scroll back up.
 * Conversion: a single action. The sign-in option is deliberately absent here —
 * someone who read to the bottom is not a returning user.
 * Contrast: rendered on the inverted surface so it reads as the end of the
 * document, not another section.
 */
export function FinalCta({ id, content }: { id: string; content: CallToActionContent }) {
  const headingId = `${id}-titulo`;

  return (
    <Section id={id} labelledBy={headingId} tone="inverted" spacing="md">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <LogoSymbol className="h-5 w-auto opacity-90" />

        <Text as="h2" id={headingId} variant="heading" className="mt-8 text-balance">
          {content.title}
        </Text>

        <Text variant="subtitle" className="mt-4 text-pretty text-content-inverted/70">
          {content.description}
        </Text>

        <AuthTriggerButton
          view="sign-up"
          size="lg"
          className="mt-9 bg-surface text-content hover:bg-surface/90 active:bg-surface/80"
        >
          {content.action}
        </AuthTriggerButton>

        <p className="mt-4 text-sm text-content-inverted/55">{content.footnote}</p>
      </div>
    </Section>
  );
}
