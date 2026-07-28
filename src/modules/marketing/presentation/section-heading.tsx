import { BrandRule } from '@/shared/ui/brand-rule';
import { Text } from '@/shared/ui/typography';

/**
 * SectionHeading
 *
 * Purpose: one heading treatment shared by every marketing section, so the
 * page reads as a single document rather than a stack of blocks.
 * Accessibility: returns a heading with a stable `id` that its parent Section
 * references through `aria-labelledby`.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <BrandRule className="mb-6" />
      <Text variant="eyebrow">{eyebrow}</Text>
      <Text as="h2" id={id} variant="heading" className="mt-3 text-balance">
        {title}
      </Text>
      <Text variant="body" className="mt-4 max-w-xl text-pretty text-lg">
        {description}
      </Text>
    </div>
  );
}
