import Link from 'next/link';
import { Mail, MapPin, MessageCircle, Phone, Tag } from 'lucide-react';

import {
  buildLeadWhatsappUrl,
  formatLeadReceivedAt,
} from '@/modules/leads/application/lead-inbox-contact';
import { encodeLeadInboxCursor } from '@/modules/leads/application/lead-inbox-cursor';
import type { LeadInboxPage } from '@/modules/leads/domain/lead-inbox-repository';
import { formatE164ToBRPhone } from '@/shared/domain/br-phone';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export function LeadInbox({ page }: { page: LeadInboxPage }) {
  if (page.contacts.length === 0) {
    return (
      <Card variant="raised" padding="lg" className="text-center">
        <Text as="h2" variant="title">Nenhum contato recebido ainda</Text>
        <Text as="p" variant="body" className="mx-auto mt-2 max-w-xl">
          Quando alguém preencher o formulário de uma página publicada, os dados aparecerão aqui.
        </Text>
        <Button asChild variant="secondary" className="mt-5">
          <Link href="/app/paginas">Ver minhas páginas</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="grid gap-4" aria-label="Contatos recebidos">
        {page.contacts.map((contact) => {
          const formattedPhone = formatE164ToBRPhone(contact.phoneE164) || contact.phoneE164;

          return (
            <li key={contact.id}>
              <Card variant="outlined" padding="md" className="space-y-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Text as="h2" variant="title" className="break-words">{contact.name}</Text>
                    <p className="mt-1 flex items-center gap-2 text-sm text-content-muted">
                      <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{contact.productName}</span>
                    </p>
                  </div>
                  <time
                    dateTime={contact.receivedAt}
                    className="shrink-0 text-sm text-content-subtle"
                  >
                    {formatLeadReceivedAt(contact.receivedAt)}
                  </time>
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <ContactField icon={Phone} label="Telefone">
                    <a className="break-all text-content underline underline-offset-4" href={`tel:${contact.phoneE164}`}>
                      {formattedPhone}
                    </a>
                  </ContactField>
                  {contact.email ? (
                    <ContactField icon={Mail} label="E-mail">
                      <a className="break-all text-content underline underline-offset-4" href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                    </ContactField>
                  ) : null}
                  {contact.city ? (
                    <ContactField icon={MapPin} label="Cidade">
                      <span className="break-words text-content">{contact.city}</span>
                    </ContactField>
                  ) : null}
                </dl>

                <Button asChild fullWidth className="sm:w-auto">
                  <a href={buildLeadWhatsappUrl(contact)} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Conversar no WhatsApp
                  </a>
                </Button>
              </Card>
            </li>
          );
        })}
      </ol>

      {page.nextCursor ? (
        <div className="flex justify-center">
          <Button asChild variant="secondary">
            <Link href={`/app/contatos?cursor=${encodeURIComponent(encodeLeadInboxCursor(page.nextCursor))}`}>
              Ver contatos anteriores
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ContactField({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Phone;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="font-medium text-content-muted">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}
