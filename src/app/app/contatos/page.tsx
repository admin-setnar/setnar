import type { Metadata } from 'next';
import Link from 'next/link';

import { decodeLeadInboxCursor } from '@/modules/leads/application/lead-inbox-cursor';
import { getCurrentUser } from '@/modules/auth/infrastructure/auth-gateway-factory';
import { getLeadInboxRepository } from '@/modules/leads/infrastructure/lead-inbox-repository-factory';
import { LeadInbox } from '@/modules/leads/presentation/lead-inbox';
import { getRepresentativeAccountRepository } from '@/modules/representatives/infrastructure/representative-account-repository-factory';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export const metadata: Metadata = { title: 'Contatos' };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const representative = await (await getRepresentativeAccountRepository()).findByProfileId(user.id);
  if (!representative) {
    return (
      <div className="space-y-7">
        <PageHeading />
        <Card variant="raised" padding="lg" className="space-y-4">
          <Text as="h2" variant="title">Conclua primeiro seu perfil profissional</Text>
          <Text as="p" variant="body">
            Seus contatos ficarão disponíveis depois que você concluir o onboarding e publicar uma página.
          </Text>
          <Button asChild>
            <Link href="/app/paginas">Concluir onboarding</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const { cursor: cursorParam } = await searchParams;
  const cursor = decodeLeadInboxCursor(cursorParam);
  const page = await (await getLeadInboxRepository()).listOwnContacts(representative.id, cursor);

  return (
    <div className="space-y-7">
      <PageHeading />
      <LeadInbox page={page} />
    </div>
  );
}

function PageHeading() {
  return (
    <div className="space-y-2">
      <Text as="h1" variant="heading">Contatos</Text>
      <Text as="p" variant="body">Pessoas que pediram contato pelas suas páginas, das mais recentes às mais antigas.</Text>
    </div>
  );
}
