import { Check } from 'lucide-react';

import { AuthTriggerButton } from '@/modules/auth/presentation/auth-trigger-button';
import type { HeroContent } from '@/modules/marketing/domain/marketing-content';
import { ProductPreview } from '@/modules/marketing/presentation/product-preview';
import { Container } from '@/shared/layout/container';
import { Text } from '@/shared/ui/typography';

/**
 * Hero
 *
 * Purpose: answer "what is this and what do I do next" above the fold.
 * Conversion: one primary action (create account) and one secondary (sign in),
 * with three short reassurance items directly below — the objections that
 * actually stop an independent seller from starting are time, cost and
 * technical skill.
 * Rendering: a Server Component. Only the two buttons are client islands.
 */
export function Hero({ content }: { content: HeroContent }) {
  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-32 lg:pt-40">
      <BackdropGrid />

      <Container className="relative">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-12">
          <div className="max-w-2xl">
            <Text variant="eyebrow" className="text-content-muted">
              {content.eyebrow}
            </Text>

            <Text as="h1" variant="display" className="mt-5 text-balance">
              {content.headline}{' '}
              <span className="text-content-subtle">{content.headlineAccent}</span>
            </Text>

            <Text variant="subtitle" className="mt-6 max-w-xl text-pretty">
              {content.subheadline}
            </Text>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <AuthTriggerButton view="sign-up" size="lg" className="min-w-0 whitespace-normal sm:w-auto">
                {content.primaryAction}
              </AuthTriggerButton>
              <AuthTriggerButton view="sign-in" size="lg" variant="secondary" className="sm:w-auto">
                {content.secondaryAction}
              </AuthTriggerButton>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {content.reassurance.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-content-muted">
                  <Check size={15} className="text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <ProductPreview className="lg:-mr-6" />
        </div>
      </Container>
    </section>
  );
}

/**
 * A very low-contrast grid that fades out downward. It gives the hero depth
 * without gradients or illustration, and disappears entirely behind content.
 */
function BackdropGrid() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[560px] opacity-[0.55] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgb(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--border)) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    />
  );
}
