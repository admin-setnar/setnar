import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildLeadWhatsappUrl,
  formatLeadReceivedAt,
  mapLeadInboxRow,
} from '@/modules/leads/application/lead-inbox-contact';
import {
  decodeLeadInboxCursor,
  encodeLeadInboxCursor,
} from '@/modules/leads/application/lead-inbox-cursor';

describe('lead inbox read projection', () => {
  it('maps the persisted JSON fields and product without exposing storage shape', () => {
    assert.deepEqual(
      mapLeadInboxRow({
        id: 'd5a42d5d-baa9-4e86-9a0f-671d3a89cd22',
        telefone_e164: '+5511999999999',
        campos: { nome: '  Ana Souza  ', cidade: ' Campinas ', email: ' ana@example.com ' },
        created_at: '2026-08-12T18:30:00.000Z',
        product: { name: 'Conexão Green' },
      }),
      {
        id: 'd5a42d5d-baa9-4e86-9a0f-671d3a89cd22',
        name: 'Ana Souza',
        phoneE164: '+5511999999999',
        city: 'Campinas',
        email: 'ana@example.com',
        productName: 'Conexão Green',
        receivedAt: '2026-08-12T18:30:00.000Z',
      },
    );
  });

  it('handles optional and malformed legacy fields without breaking the item', () => {
    const contact = mapLeadInboxRow({
      id: 'ad3b58ec-4cf5-4780-9254-2e80c9686bb1',
      telefone_e164: '+5511888888888',
      campos: { nome: ' ', cidade: 10, email: null },
      created_at: '2026-08-12T18:30:00.000Z',
      product: null,
    });

    assert.equal(contact.name, 'Contato');
    assert.equal(contact.city, null);
    assert.equal(contact.email, null);
    assert.equal(contact.productName, 'Página não identificada');
  });
});

describe('lead inbox cursor', () => {
  it('round-trips both deterministic sort fields', () => {
    const cursor = {
      receivedAt: '2026-08-12T18:30:00.000Z',
      id: 'd5a42d5d-baa9-4e86-9a0f-671d3a89cd22',
    };
    assert.deepEqual(decodeLeadInboxCursor(encodeLeadInboxCursor(cursor)), cursor);
  });

  it('rejects malformed, oversized and non-canonical values', () => {
    assert.equal(decodeLeadInboxCursor(undefined), null);
    assert.equal(decodeLeadInboxCursor(['a', 'b']), null);
    assert.equal(decodeLeadInboxCursor('x'.repeat(257)), null);
    assert.equal(decodeLeadInboxCursor(Buffer.from(JSON.stringify({ receivedAt: 'yesterday', id: 'nope' })).toString('base64url')), null);
  });
});

describe('lead inbox contact actions', () => {
  it('builds a WhatsApp deep link with a prefilled message and no automatic send', () => {
    const url = new URL(buildLeadWhatsappUrl({
      name: 'Ana Souza',
      phoneE164: '+55 (11) 99999-9999',
      productName: 'Conexão Green',
    }));

    assert.equal(url.origin, 'https://wa.me');
    assert.equal(url.pathname, '/5511999999999');
    assert.equal(url.searchParams.get('text'), 'Olá, Ana Souza! Vi seu contato sobre Conexão Green na minha página.');
  });

  it('formats received time in the product timezone', () => {
    assert.match(formatLeadReceivedAt('2026-08-12T18:30:00.000Z'), /12.*ago.*2026.*15:30/i);
  });
});
