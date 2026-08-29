import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

/**
 * SET-105 (AUDIT_SET-101 §8) — attribution por ação em `PublishedPageActions`.
 * Mesmo estilo de asserção por texto-fonte que `divulgacao-flow.test.ts`:
 * a prova de que a URL do QR Code carrega `?src=qrcode` não pode vir de um
 * navegador real sem decodificar a imagem gerada (dependência nova só para
 * o teste, fora do escopo desta issue) — este arquivo prova estruturalmente
 * qual URL o componente constrói e passa para cada ação. O comportamento
 * observável de "Copiar link"/"Abrir site" — o que é de fato copiado/aberto
 * por um navegador real — é coberto por `tests/e2e/publication-management.spec.ts`.
 */
function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const actions = source('src/modules/representatives/presentation/published-page-actions.tsx');

describe('PublishedPageActions attribution (SET-105)', () => {
  it('tags the copied link with ?src=direct, and copies that tagged value, not the bare url', () => {
    assert.match(actions, /const copyLinkUrl = `\$\{url\}\?src=direct`;/);
    assert.match(actions, /navigator\.clipboard\.writeText\(copyLinkUrl\)/);
  });

  it('tags the QR Code with ?src=qrcode — distinct from the copied link — and passes that to QrCodeDialog', () => {
    assert.match(actions, /const qrCodeUrl = `\$\{url\}\?src=qrcode`;/);
    assert.match(actions, /<QrCodeDialog[^>]*\burl=\{qrCodeUrl\}/);
  });

  it('"Abrir site" keeps the bare canonical url — not a distribution action', () => {
    assert.match(actions, /<a href=\{url\}/);
    // Never accidentally the tagged variants.
    assert.doesNotMatch(actions, /<a href=\{copyLinkUrl\}/);
    assert.doesNotMatch(actions, /<a href=\{qrCodeUrl\}/);
  });

  it('the manual-copy fallback shown on clipboard failure offers the tagged link, matching what the button tried to copy', () => {
    assert.match(actions, /Copie manualmente: \$\{copyLinkUrl\}/);
  });
});
