import { headers } from 'next/headers';

import { Benefits } from '@/modules/marketing/presentation/benefits';
import { FinalCta } from '@/modules/marketing/presentation/final-cta';
import { Hero } from '@/modules/marketing/presentation/hero';
import { HowItWorks } from '@/modules/marketing/presentation/how-it-works';
import { resolveTenant } from '@/modules/tenancy/application/resolve-tenant';
import { buildStructuredData } from '@/config/seo';
import { SECTION_IDS } from '@/config/site';
import { Footer } from '@/shared/layout/footer';
import { Navbar } from '@/shared/layout/navbar';

/**
 * The gateway page.
 *
 * Its only jobs are: explain the product, let a returning user sign in, and let
 * a new user create an account. It is a Server Component — the only client
 * JavaScript on first load is the navbar's scroll state and the buttons that
 * open the auth modals.
 */
export default async function HomePage() {
  const tenant = await resolveTenant((await headers()).get('host'));
  const { marketing, brand } = tenant;

  return (
    <>
      <script
        type="application/ld+json"
        // Serialized on the server from our own typed data — never user input.
        dangerouslySetInnerHTML={{ __html: buildStructuredData(tenant) }}
      />

      <Navbar brandName={brand.name} items={marketing.navigation} />

      <main id="conteudo">
        <Hero content={marketing.hero} />
        <HowItWorks id={SECTION_IDS.howItWorks} content={marketing.howItWorks} />
        <Benefits id={SECTION_IDS.benefits} content={marketing.benefits} />
        <FinalCta id={SECTION_IDS.cta} content={marketing.callToAction} />
      </main>

      <Footer
        brandName={brand.name}
        legalName={brand.legalName}
        content={marketing.footer}
      />
    </>
  );
}
