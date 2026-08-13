import Link from 'next/link';

import type { CommercialPageTemplate } from '@/modules/representatives/domain/commercial-page-template';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { AuthorizedRepresentativeIdentificationBlock } from '@/modules/representatives/presentation/authorized-representative-identification-block';
import { CommercialPageWidget } from '@/modules/representatives/presentation/commercial-page-widgets';
import { ComplianceNotice } from '@/modules/representatives/presentation/compliance-notice';
import { WhatsappCta } from '@/modules/representatives/presentation/whatsapp-cta';
import { Container } from '@/shared/layout/container';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

const commercialCard = 'rounded-2xl border-line bg-surface-raised shadow-[0_8px_24px_rgba(20,67,43,0.08)]';
const sectionHeading = 'text-[clamp(1.75rem,3vw,2.35rem)] font-extrabold leading-tight tracking-[-0.025em] text-[rgb(var(--palette-900))]';

export function CommercialHeader({ representative, product }: { representative: Representative; product: RepresentativeProduct }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
      <Container className="max-w-[1120px]">
        <div className="flex min-h-[76px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full bg-[rgb(var(--commercial-sun))] shadow-[0_0_0_5px_rgb(var(--commercial-sun)/0.18)]" />
            <div className="min-w-0">
              <p className="commercial-heading-font truncate text-lg font-extrabold leading-tight text-[rgb(var(--palette-900))]">{product.name}</p>
              <p className="mt-0.5 hidden truncate text-xs text-content-muted sm:block">{representative.name} · Licenciado Autorizado iGreen Energy · ID {representative.authorizationId}</p>
            </div>
          </div>
          <WhatsappCta representative={representative} product={product} fullWidth={false} />
        </div>
      </Container>
    </header>
  );
}

export function CommercialHero({ template, representative, product }: { template: CommercialPageTemplate; representative: Representative; product: RepresentativeProduct }) {
  return (
    <section className="overflow-hidden bg-surface py-14 sm:py-[72px]">
      <Container className="max-w-[1120px]">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
          <div>
            <span className="inline-flex rounded-full bg-brand-subtle px-3.5 py-1.5 text-sm font-bold normal-case tracking-normal text-brand">{template.eyebrow}</span>
            <Text as="h1" variant="display" className="mt-4 max-w-[680px] text-[clamp(2.1rem,4.5vw,3.1rem)] font-extrabold leading-[1.16] tracking-[-0.035em] text-[rgb(var(--palette-900))]">{template.headline}</Text>
            <Text as="p" variant="subtitle" className="mt-5 max-w-2xl text-[1.08rem] leading-[1.65] text-content-muted">{template.subheadline}</Text>
            <div className="mt-7 max-w-sm"><WhatsappCta representative={representative} product={product} /></div>
            <Text as="p" variant="caption" className="mt-3 text-content-muted">{template.heroNote}</Text>
          </div>
          <div className="relative before:absolute before:-right-16 before:-top-14 before:h-52 before:w-52 before:rounded-full before:bg-brand-subtle before:content-['']">
            <div className="relative"><CommercialPageWidget widget={template.widget} /></div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function TrustStrip({ points }: { points: readonly string[] }) {
  return (
    <div className="border-y border-line bg-brand-subtle">
      <Container className="max-w-[1120px]">
        <ul className="grid gap-3 py-5 text-center text-sm font-semibold text-[rgb(var(--palette-900))] sm:grid-cols-3">
          {points.map((point) => <li key={point}><span aria-hidden="true" className="mr-1.5 text-brand">✓</span>{point}</li>)}
        </ul>
      </Container>
    </div>
  );
}

export function IdentificationSection({ representative, product }: { representative: Representative; product: RepresentativeProduct }) {
  return <section aria-labelledby="representative-title" className="bg-surface py-14 sm:py-16"><Container className="max-w-[920px]"><AuthorizedRepresentativeIdentificationBlock representative={representative} product={product} /></Container></section>;
}

export function StepsSection({ template }: { template: CommercialPageTemplate }) {
  return (
    <section className="bg-surface py-14 sm:py-20">
      <Container className="max-w-[1120px]">
        <div className="mx-auto max-w-2xl text-center"><Text as="h2" variant="heading" className={sectionHeading}>{template.howItWorksTitle}</Text><Text as="p" variant="subtitle" className="mt-3 text-base leading-relaxed">{template.howItWorksIntro}</Text></div>
        <ol className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {template.steps.map((step, index) => <li key={step.title}><Card padding="md" className={`${commercialCard} h-full`}><span aria-hidden="true" className="commercial-heading-font inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-contrast">{index + 1}</span><Text as="h3" variant="title" className="mt-4 text-lg font-bold text-[rgb(var(--palette-900))]">{step.title}</Text><Text as="p" variant="body" className="mt-2 text-[15px] leading-relaxed">{step.description}</Text></Card></li>)}
        </ol>
      </Container>
    </section>
  );
}

export function OfferSection({ template }: { template: CommercialPageTemplate }) {
  return (
    <section className="border-y border-line bg-brand-subtle py-14 sm:py-20">
      <Container className="max-w-[1120px]">
        <div className="mx-auto max-w-2xl text-center"><Text as="h2" variant="heading" className={sectionHeading}>{template.offerTitle}</Text><Text as="p" variant="subtitle" className="mt-3 text-base leading-relaxed">{template.offerIntro}</Text></div>
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{template.offerItems.map((item) => <Card key={item.title} padding="md" className={commercialCard}><span aria-hidden="true" className="mb-4 block h-1.5 w-10 rounded-full bg-[rgb(var(--commercial-sun))]" /><Text as="h3" variant="title" className="text-lg font-bold text-[rgb(var(--palette-900))]">{item.title}</Text><Text as="p" variant="body" className="mt-2 text-[15px] leading-relaxed">{item.description}</Text></Card>)}</div>
      </Container>
    </section>
  );
}

export function FaqSection({ template }: { template: CommercialPageTemplate }) {
  return (
    <section className="bg-surface py-14 sm:py-20">
      <Container className="max-w-[760px]">
        <Text as="h2" variant="heading" className={`${sectionHeading} text-center`}>Perguntas frequentes</Text>
        <div className="mt-8 space-y-3">{template.faq.map((item) => <details key={item.question} className={`${commercialCard} group px-5 py-4`}><summary className="commercial-heading-font cursor-pointer list-none font-bold text-[rgb(var(--palette-900))] marker:hidden">{item.question}<span aria-hidden="true" className="float-right ml-4 text-xl text-brand transition-transform group-open:rotate-45">+</span></summary><Text as="p" variant="body" className="mt-3 border-t border-line pt-3 text-[15px]">{item.answer}</Text></details>)}</div>
      </Container>
    </section>
  );
}

export function FinalCta({ template, representative, product }: { template: CommercialPageTemplate; representative: Representative; product: RepresentativeProduct }) {
  return (
    <section className="bg-surface pb-14 sm:pb-20">
      <Container className="max-w-[920px]">
        <div className="rounded-[24px] bg-surface-inverted px-6 py-12 text-center shadow-[0_14px_36px_rgba(7,49,29,0.2)] sm:px-12">
          <Text as="h2" variant="heading" className="text-[clamp(1.8rem,3vw,2.4rem)] font-extrabold text-white">{template.finalTitle}</Text>
          <Text as="p" variant="subtitle" className="mx-auto mt-3 max-w-2xl text-base text-white/80">{template.finalDescription}</Text>
          <div className="mx-auto mt-7 max-w-sm"><WhatsappCta representative={representative} product={product} tone="yellow" /></div>
        </div>
      </Container>
    </section>
  );
}

export function CommercialFooter({ template, representative, productSlug }: { template: CommercialPageTemplate; representative: Representative; productSlug: string }) {
  return (
    <footer className="border-t border-line bg-brand-subtle py-10 text-center">
      <Container className="max-w-[820px]"><Text as="p" variant="caption" className="text-content-muted">{template.footerNotice}</Text><div className="mt-4"><ComplianceNotice productSlug={productSlug} /></div><Text as="p" variant="caption" className="mt-4 text-content-muted">Página produzida pela SETNAR para <strong>{representative.name}</strong>, Licenciado Autorizado iGreen Energy · ID {representative.authorizationId}.</Text><Link href="/privacidade" className="mt-4 inline-block text-sm font-semibold text-brand underline underline-offset-4">Política de Privacidade da SETNAR</Link></Container>
    </footer>
  );
}
