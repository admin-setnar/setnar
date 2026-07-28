/**
 * Marketing content is *data*, not markup.
 *
 * Every string rendered by the public gateway comes from here, which is what
 * makes the page tenant-agnostic: swapping the tenant swaps the whole page.
 * Icons are referenced by key (never as React components) so this structure
 * stays serializable and can move to a database or CMS later without changing
 * a single component.
 */
import type { IconKey } from '@/modules/marketing/domain/icon-key';

export interface NavigationItem {
  readonly label: string;
  readonly href: string;
  /** Marks destinations that do not exist yet (rendered as non-interactive). */
  readonly placeholder?: boolean;
}

export interface HeroContent {
  readonly eyebrow: string;
  readonly headline: string;
  readonly headlineAccent: string;
  readonly subheadline: string;
  readonly primaryAction: string;
  readonly secondaryAction: string;
  readonly reassurance: readonly string[];
}

export interface StepContent {
  readonly icon: IconKey;
  readonly title: string;
  readonly description: string;
}

export interface BenefitContent {
  readonly icon: IconKey;
  readonly title: string;
  readonly description: string;
}

export interface SectionHeading {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}

export interface HowItWorksContent extends SectionHeading {
  readonly steps: readonly StepContent[];
}

export interface BenefitsContent extends SectionHeading {
  readonly items: readonly BenefitContent[];
}

export interface CallToActionContent {
  readonly title: string;
  readonly description: string;
  readonly action: string;
  readonly footnote: string;
}

export interface FooterLinkGroup {
  readonly title: string;
  readonly links: readonly NavigationItem[];
}

export interface SocialLink {
  readonly icon: IconKey;
  readonly label: string;
  readonly href: string;
  readonly placeholder?: boolean;
}

export interface FooterContent {
  readonly description: string;
  readonly groups: readonly FooterLinkGroup[];
  readonly social: readonly SocialLink[];
  /** Compliance line. Rendered verbatim — see README, "Compliance". */
  readonly legalNotice: string;
}

export interface MarketingContent {
  readonly navigation: readonly NavigationItem[];
  readonly hero: HeroContent;
  readonly howItWorks: HowItWorksContent;
  readonly benefits: BenefitsContent;
  readonly callToAction: CallToActionContent;
  readonly footer: FooterContent;
}
