import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
  formatE164ToBRPhone,
  formatPhoneToE164,
  maskBRPhone,
} from '@/shared/domain/br-phone';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const phoneFeatureTextFiles = [
  'src/modules/auth/domain/auth.ts',
  'src/modules/auth/infrastructure/supabase-auth-gateway.ts',
  'src/modules/auth/presentation/actions.ts',
  'src/modules/auth/presentation/schemas/sign-up.schema.ts',
  'src/modules/auth/presentation/sign-up-form.tsx',
  'src/shared/domain/br-phone.ts',
  'src/modules/representatives/presentation/onboarding-form.tsx',
  'src/app/app/paginas/page.tsx',
  'src/modules/representatives/presentation/activation-view-state.ts',
  'src/modules/representatives/presentation/product-activation-card.tsx',
  'src/app/layout.tsx',
  'supabase/migrations/20260819000000_add_signup_phone_to_profiles.sql',
  'docs/PRODUCT.md',
] as const;

const commonMojibake = /Ã[\u0080-\u00bf\u0192\u201a]|Â[\u0080-\u00bf]|â[€‚]|ï¿½/;

const action = source('src/modules/auth/presentation/actions.ts');
const form = source('src/modules/auth/presentation/sign-up-form.tsx');
const gateway = source('src/modules/auth/infrastructure/supabase-auth-gateway.ts');
const currentUser = source('src/modules/auth/infrastructure/auth-gateway-factory.ts');
const onboarding = source('src/modules/representatives/presentation/onboarding-form.tsx');
const migration = source('supabase/migrations/20260819000000_add_signup_phone_to_profiles.sql');
const rootLayout = source('src/app/layout.tsx');
const productCard = source('src/modules/representatives/presentation/product-activation-card.tsx');

describe('shared Brazilian phone formatting', () => {
  it('masks typing and paste without exceeding eleven national digits', () => {
    assert.equal(maskBRPhone('11988887777'), '(11) 98888-7777');
    assert.equal(maskBRPhone('(11) 98888-7777'), '(11) 98888-7777');
    assert.equal(maskBRPhone('11988887777999'), '(11) 98888-7777');
  });

  it('normalizes and restores the account phone', () => {
    assert.equal(formatPhoneToE164('(11) 98888-7777'), '+5511988887777');
    assert.equal(formatE164ToBRPhone('+5511988887777'), '(11) 98888-7777');
  });
});

describe('signup phone contract', () => {
  it('normalizes before the gateway and persists only canonical metadata', () => {
    assert.match(action, /phone: formatPhoneToE164\(parsed\.data\.phone\)/);
    assert.match(action, /safeRedirectTarget\(next \?\? '\/app\/paginas'\)/);
    assert.match(gateway, /data: \{ full_name: data\.name\.trim\(\), phone: data\.phone \}/);
    assert.doesNotMatch(gateway, /maskBRPhone/);
  });

  it('collects an accessible editable telephone without exposing technical wording', () => {
    assert.match(form, /label="Telefone comercial"/);
    assert.match(form, /hint="Este número será usado no botão de WhatsApp das suas páginas\."/);
    assert.match(form, /inputMode="tel"/);
    assert.match(form, /autoComplete="tel"/);
    assert.match(form, /aria-describedby=\{describedBy\}/);
    assert.doesNotMatch(form, /E\.164|metadata|raw_user_meta_data/);
  });

  it('keeps the feature text free of common mojibake artifacts', () => {
    for (const path of phoneFeatureTextFiles) {
      assert.doesNotMatch(source(path), commonMojibake, `Mojibake found in ${path}`);
    }
  });

  it('stores a nullable owner-readable signup snapshot and rejects invalid metadata', () => {
    assert.match(migration, /add column phone text;/);
    assert.match(migration, /constraint profiles_phone_br_e164[\s\S]*not valid;/);
    assert.match(migration, /if v_signup_phone !~ '\^\\\+55\\d\{10,11\}\$'/);
    assert.doesNotMatch(migration, /alter column phone set not null/i);
    assert.doesNotMatch(migration, /update\s+public\.profiles/i);
    assert.match(currentUser, /select\('full_name, tenant_id, phone'\)/);
  });

  it('prefills onboarding while leaving legacy accounts empty and editable', () => {
    assert.match(onboarding, /initialPhone: string \| null/);
    assert.match(onboarding, /phone: initialPhone \? formatE164ToBRPhone\(initialPhone\) : ''/);
    assert.match(onboarding, /register\('phone'\)/);
  });
});

describe('accessibility and blocker presentation', () => {
  it('keeps the global skip link tied to the App Shell main landmark', () => {
    assert.match(rootLayout, /href="#conteudo"/);
    assert.match(rootLayout, /Ir para o conteúdo principal/);
  });

  it('keeps publication copy concise and exposes the blocking reason', () => {
    assert.match(productCard, /aria-describedby=\{!viewState\.canPublish \? publicationBlockerId : undefined\}/);
    assert.doesNotMatch(productCard, />Complete seu perfil para publicar</);
    assert.doesNotMatch(productCard, />Ative sua assinatura para publicar</);
  });
});
