'use client';

import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export default function ContactsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card variant="raised" padding="lg" className="max-w-xl space-y-4" role="alert">
      <Text as="h1" variant="title">Não foi possível carregar seus contatos</Text>
      <Text as="p" variant="body">Verifique sua conexão e tente novamente. Nenhum dado foi alterado.</Text>
      <Button type="button" onClick={reset}>Tentar novamente</Button>
    </Card>
  );
}
