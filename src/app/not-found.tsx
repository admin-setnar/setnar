import Link from 'next/link';

import { Container } from '@/shared/layout/container';
import { Button } from '@/shared/ui/button';
import { Text } from '@/shared/ui/typography';

/**
 * Not found.
 *
 * An empty state, not an error page: it says what happened and offers the one
 * action that makes sense from here.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center">
      <Container width="narrow" className="text-center">
        <Text variant="eyebrow">Erro 404</Text>
        <Text as="h1" variant="heading" className="mt-4">
          Esta página não existe
        </Text>
        <Text variant="subtitle" className="mx-auto mt-4 max-w-md">
          O endereço pode ter mudado ou o link pode estar incompleto.
        </Text>
        <Button asChild size="lg" className="mt-8">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </Container>
    </main>
  );
}
