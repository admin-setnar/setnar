import { resolveIcon } from '@/modules/marketing/presentation/icon-registry';
import type { FooterContent } from '@/modules/marketing/domain/marketing-content';
import { Container } from '@/shared/layout/container';
import { Logo } from '@/shared/brand/logo';
import { Text } from '@/shared/ui/typography';

/**
 * Footer
 *
 * Purpose: close the page with identity, secondary navigation and the legal
 * information the product is required to show.
 * Compliance: `legalNotice` is rendered verbatim and must stay visible — it is
 * the statement that SETNAR is not an official channel of any brand its users
 * represent. See README, "Compliance".
 * Accessibility: a real <footer> landmark; each link group is labelled by its
 * own heading, and unbuilt destinations are `aria-disabled` rather than links
 * that go nowhere.
 */
export function Footer({
  brandName,
  legalName,
  content,
}: {
  brandName: string;
  legalName: string;
  content: FooterContent;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-surface">
      <Container>
        <div className="grid gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-24">
          {/* The logo is inline-flex, so it needs a block wrapper of its own:
              vertical margin has no effect on an inline element, which is why
              `space-y-*` alone would not separate it from the text below. */}
          <div className="max-w-sm">
            <div>
              <Logo name={brandName} />
            </div>
            <Text as="p" variant="caption" className="mt-4 leading-relaxed">
              {content.description}
            </Text>
            <ul className="mt-5 flex items-center gap-1">
              {content.social.map((social) => {
                const Icon = resolveIcon(social.icon);
                return (
                  <li key={social.label}>
                    <span
                      aria-disabled={social.placeholder || undefined}
                      title={social.placeholder ? 'Em breve' : undefined}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-content-subtle transition-colors duration-fast hover:bg-surface-sunken hover:text-content"
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span className="sr-only">{social.label}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:gap-16">
            {content.groups.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <Text as="h2" variant="caption" className="font-semibold text-content">
                  {group.title}
                </Text>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      {link.placeholder ? (
                        <span aria-disabled="true" className="text-sm text-content-subtle">
                          {link.label}
                        </span>
                      ) : (
                        <a
                          href={link.href}
                          className="rounded-sm text-sm text-content-muted transition-colors duration-fast hover:text-content"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line py-8 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-xs leading-relaxed text-content-subtle">
            {content.legalNotice}
          </p>
          <p className="shrink-0 text-xs text-content-subtle">
            © {year} {legalName}
          </p>
        </div>
      </Container>
    </footer>
  );
}
