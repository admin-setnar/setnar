import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const layout = source('src/app/app/layout.tsx');
const rootPage = source('src/app/app/page.tsx');
const pages = source('src/app/app/paginas/page.tsx');
const account = source('src/app/app/conta/page.tsx');
const navigation = source('src/app/app/app-navigation.tsx');
const actions = source('src/modules/representatives/presentation/actions.ts');
const onboarding = source('src/modules/representatives/presentation/onboarding-form.tsx');
const qrCode = source('src/modules/representatives/presentation/qr-code-card.tsx');
const migration = source('supabase/migrations/20260818000000_require_professional_profile_phone.sql');

describe('authenticated App Shell contract', () => {
  it('guards every /app subroute in the server layout and redirects /app to pages', () => {
    assert.match(layout, /getCurrentUser\(\)/);
    assert.match(layout, /if \(!user\) redirect\('\/entrar\?next=\/app'\)/);
    assert.match(rootPage, /redirect\('\/app\/paginas'\)/);
  });

  it('exposes only live Pages and Account destinations with active-state semantics', () => {
    assert.match(navigation, /href: '\/app\/paginas'/);
    assert.match(navigation, /href: '\/app\/conta'/);
    assert.match(navigation, /aria-current=\{active \? 'page'/);
    assert.doesNotMatch(navigation, /desempenho|materiais|preview/i);
  });

  it('keeps route-specific data outside the shared layout', () => {
    assert.doesNotMatch(layout, /RepresentativeAccountRepository|RepresentativeCatalogRepository/);
    assert.match(pages, /getRepresentativeCatalogRepository/);
    assert.match(account, /getRepresentativeAccountRepository/);
  });

  it('prefills onboarding from the authenticated profile without silently persisting it', () => {
    assert.match(pages, /initialDisplayName=\{user\.name\}/);
    assert.match(pages, /initialPhone=\{user\.phone\}/);
    assert.match(onboarding, /displayName: initialDisplayName/);
    assert.match(onboarding, /initialPhone \? formatE164ToBRPhone\(initialPhone\) : ''/);
    assert.match(onboarding, /registerRepresentativeAction\(values\)/);
  });

  it('revalidates the precise pages and account routes', () => {
    assert.equal(actions.match(/^\s+revalidatePath\('\/app\/paginas'\);$/gm)?.length, 3);
    assert.equal(actions.match(/^\s+revalidatePath\('\/app\/conta'\);$/gm)?.length, 1);
    assert.doesNotMatch(actions, /^\s+revalidatePath\('\/app'\);$/m);
  });

  it('provides retry, clipboard feedback and manual link selection for QR Codes', () => {
    assert.match(qrCode, /Tentar novamente/);
    assert.match(qrCode, /navigator\.clipboard\.writeText/);
    assert.match(qrCode, /\.select\(\)/);
    assert.match(qrCode, /aria-live="polite"/);
  });
});

describe('professional profile migration contract', () => {
  it('diagnoses legacy rows without backfilling or deleting them', () => {
    assert.match(migration, /missing_phone/);
    assert.match(migration, /invalid_phone/);
    assert.doesNotMatch(migration, /update\s+public\.representatives\s+set\s+phone/i);
    assert.doesNotMatch(migration, /delete\s+from\s+public\.representatives/i);
  });

  it('uses a transitional NOT VALID format constraint and defers NOT NULL', () => {
    assert.match(migration, /constraint representatives_phone_e164[\s\S]*not valid;/);
    assert.doesNotMatch(migration, /alter column phone set not null/i);
  });

  it('blocks missing phone on new writes and profile updates', () => {
    assert.match(migration, /before insert or update of phone/);
    assert.equal(migration.match(/select 'phone_required'::text/g)?.length, 2);
    assert.equal(migration.match(/select 'phone_invalid'::text/g)?.length, 2);
  });

  it('derives the edited representative from auth.uid and explicitly limits grants', () => {
    assert.match(migration, /where profile_id = auth\.uid\(\)/);
    assert.match(migration, /revoke execute on function public\.update_representative_profile[\s\S]*from public, anon;/);
    assert.match(migration, /grant execute on function public\.update_representative_profile[\s\S]*to authenticated;/);
  });
});
