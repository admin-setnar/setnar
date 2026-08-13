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

export function CommercialHeader({ representative, product }: { representative: Representative; product: RepresentativeProduct }) {
  return <header className="border-b border-line bg-surface/95"><Container><div className="flex min-h-20 items-center justify-between gap-4"><div><p className="font-semibold text-content">{product.name}</p><p className="mt-1 hidden text-xs text-content-subtle sm:block">{representative.name} · Licenciado Autorizado iGreen Energy · ID {representative.authorizationId}</p></div><WhatsappCta representative={representative} product={product} fullWidth={false} /></div></Container></header>;
}

export function CommercialHero({ template, representative, product }: { template: CommercialPageTemplate; representative: Representative; product: RepresentativeProduct }) {
  return <section className="bg-surface-sunken py-14 sm:py-20"><Container><div className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr]"><div><Text variant="eyebrow">{template.eyebrow}</Text><Text as="h1" variant="display" className="mt-3 max-w-4xl">{template.headline}</Text><Text as="p" variant="subtitle" className="mt-5 max-w-2xl">{template.subheadline}</Text><div className="mt-7 max-w-md"><WhatsappCta representative={representative} product={product} /></div><Text as="p" variant="caption" className="mt-3">{template.heroNote}</Text></div><CommercialPageWidget widget={template.widget} /></div></Container></section>;
}

export function TrustStrip({ points }: { points: readonly string[] }) {
  return <div className="border-y border-line bg-surface"><Container><ul className="grid gap-3 py-5 text-center text-sm font-medium text-content sm:grid-cols-3">{points.map((point) => <li key={point}>✓ {point}</li>)}</ul></Container></div>;
}

export function IdentificationSection({ representative }: { representative: Representative }) {
  return <section aria-labelledby="representative-title" className="py-14 sm:py-16"><Container width="narrow"><AuthorizedRepresentativeIdentificationBlock representative={representative} /></Container></section>;
}

export function StepsSection({ template }: { template: CommercialPageTemplate }) {
  return <section className="bg-surface-sunken py-14 sm:py-20"><Container><div className="max-w-2xl"><Text as="h2" variant="heading">{template.howItWorksTitle}</Text><Text as="p" variant="subtitle" className="mt-3">{template.howItWorksIntro}</Text></div><ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{template.steps.map((step,index) => <li key={step.title}><Card padding="md" className="h-full"><span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-contrast">{index+1}</span><Text as="h3" variant="title" className="mt-4">{step.title}</Text><Text as="p" variant="body" className="mt-2">{step.description}</Text></Card></li>)}</ol></Container></section>;
}

export function OfferSection({ template }: { template: CommercialPageTemplate }) {
  return <section className="py-14 sm:py-20"><Container><div className="max-w-2xl"><Text as="h2" variant="heading">{template.offerTitle}</Text><Text as="p" variant="subtitle" className="mt-3">{template.offerIntro}</Text></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{template.offerItems.map((item) => <Card key={item.title} padding="md"><Text as="h3" variant="title">{item.title}</Text><Text as="p" variant="body" className="mt-2">{item.description}</Text></Card>)}</div></Container></section>;
}

export function FaqSection({ template }: { template: CommercialPageTemplate }) {
  return <section className="bg-surface-sunken py-14 sm:py-20"><Container width="narrow"><Text as="h2" variant="heading">Perguntas frequentes</Text><div className="mt-7 divide-y divide-line rounded-lg border border-line bg-surface">{template.faq.map((item) => <details key={item.question} className="group p-5"><summary className="cursor-pointer list-none pr-8 font-semibold text-content marker:hidden">{item.question}<span aria-hidden="true" className="float-right transition-transform group-open:rotate-45">+</span></summary><Text as="p" variant="body" className="mt-3">{item.answer}</Text></details>)}</div></Container></section>;
}

export function FinalCta({ template, representative, product }: { template: CommercialPageTemplate; representative: Representative; product: RepresentativeProduct }) {
  return <section className="py-14 sm:py-20"><Container width="narrow"><Card variant="sunken" padding="lg" className="text-center"><Text as="h2" variant="heading">{template.finalTitle}</Text><Text as="p" variant="subtitle" className="mt-3">{template.finalDescription}</Text><div className="mx-auto mt-7 max-w-md"><WhatsappCta representative={representative} product={product} /></div></Card></Container></section>;
}

export function CommercialFooter({ template, representative, productSlug }: { template: CommercialPageTemplate; representative: Representative; productSlug: string }) {
  return <footer className="border-t border-line bg-surface-sunken py-10"><Container width="narrow"><Text as="p" variant="caption">{template.footerNotice}</Text><div className="mt-4"><ComplianceNotice productSlug={productSlug} /></div><Text as="p" variant="caption" className="mt-4">Página produzida pela SETNAR para <strong>{representative.name}</strong>, Licenciado Autorizado iGreen Energy · ID {representative.authorizationId}.</Text><Link href="/privacidade" className="mt-4 inline-block text-sm font-medium text-content underline underline-offset-4">Política de Privacidade da SETNAR</Link></Container></footer>;
}
