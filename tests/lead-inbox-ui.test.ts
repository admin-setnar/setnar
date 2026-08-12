import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const page = source('src/app/app/contatos/page.tsx');
const inbox = source('src/modules/leads/presentation/lead-inbox.tsx');
const loading = source('src/app/app/contatos/loading.tsx');
const error = source('src/app/app/contatos/error.tsx');
const repository = source('src/modules/leads/infrastructure/supabase-lead-inbox-repository.ts');

describe('/app/contatos presentation contract', () => {
  it('derives the representative server-side and never accepts it from search params', () => {
    assert.match(page, /findByProfileId\(user\.id\)/);
    assert.match(page, /listOwnContacts\(representative\.id, cursor\)/);
    assert.doesNotMatch(page, /representativeId.*searchParams/);
  });

  it('provides empty, success, loading and recoverable error states', () => {
    assert.match(inbox, /Nenhum contato recebido ainda/);
    assert.match(inbox, /page\.contacts\.map/);
    assert.match(loading, /role="status"/);
    assert.match(error, /role="alert"/);
    assert.match(error, /reset/);
  });

  it('renders optional e-mail/city conditionally and exposes contact actions', () => {
    assert.match(inbox, /contact\.email \?/);
    assert.match(inbox, /contact\.city \?/);
    assert.match(inbox, /mailto:/);
    assert.match(inbox, /buildLeadWhatsappUrl/);
    assert.match(inbox, /Conversar no WhatsApp/);
  });

  it('uses a minimal read and two-field keyset pagination without service_role', () => {
    assert.match(repository, /select\('id, telefone_e164, campos, created_at, product:products\(name\)'\)/);
    assert.match(repository, /order\('created_at'.*false/);
    assert.match(repository, /order\('id'.*false/);
    assert.match(repository, /created_at\.lt.*created_at\.eq.*id\.lt/);
    assert.doesNotMatch(repository, /service.role|SUPABASE_SERVICE_ROLE_KEY/i);
  });
});
