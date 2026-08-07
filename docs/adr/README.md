# Architecture Decision Records

This is the index of every ADR in the project: 63 decisions, numbered `ADR-001`
through `ADR-063`, one file per decision. This folder is the authority on
**why the code is the way it is** — see `docs/README.md` § *Which document
wins* on how an ADR relates to the normative documents.

**Migrated from `README.md` (repository root) on 2026-08-05, by decision of
this certification audit.** Every ADR was moved into its own file **without
being rewritten** — content, wording, and reasoning are byte-for-byte what
they were in the root `README.md`'s ADR log. Migration was mechanical (a
script split the log by heading, verified against a character count of the
original section) specifically so that no ADR's meaning could drift during
the move. Numbering, order and content are unchanged; only the container
changed, from sections in one 232 KB file to one file per decision.

**The migration rule that governed the old log still governs this one**,
carried over unchanged: an ADR that has already landed — same as a migration
under `supabase/migrations/` — is never edited to say something different
than what was decided. A correction is a new ADR, cross-referenced from the
one it corrects (see *Related*, below). Six ADRs in this log already follow
that pattern (051↔052, 053↔054, 058↔059), and it continues to apply to every
ADR from here on, in `docs/adr/` exactly as it did in the old log.

## How to read this index

- **Normative document** — which document (if any) an ADR's decision belongs
  to, per the hierarchy in `docs/README.md`. Assigned by topic, from the ADR's
  own content — not stated inside the original ADRs, which predate that
  hierarchy. Where an ADR is a pure implementation or bugfix decision with no
  normative document affected, this is `—`.
- **Related** — a correction, extension, or sequencing relationship to
  another ADR, stated where the original text makes one explicit. Most ADRs
  have none.
- **Status and date** — deliberately **not** columns in this table. The
  original ADRs do not carry a structured status or date field (they are
  narrative: Decision / Alternatives / Consequence / Reversal cost), and nothing
  here invents one. Every ADR in this log describes a decision that was
  **implemented** at the time it was written — treat the log as chronological
  by number, and use the commit history or the referenced migration timestamp
  where a specific date matters. See *Outstanding gaps*, below.

## Index

| # | Title | Normative document | Related | File |
|---|---|---|---|---|
| 001 | Tenant resolution by `Host` header, in the application layer | ARCHITECTURE.md | — | [`ADR-001-tenant-resolution-by-host-header-in-the-application.md`](ADR-001-tenant-resolution-by-host-header-in-the-application.md) |
| 002 | Branding as injected CSS custom properties | DESIGN_SYSTEM.md | — | [`ADR-002-branding-as-injected-css-custom-properties.md`](ADR-002-branding-as-injected-css-custom-properties.md) |
| 003 | Authentication behind a port, with a deliberately fake adapter | ARCHITECTURE.md | — | [`ADR-003-authentication-behind-a-port-with-a-deliberately-fake.md`](ADR-003-authentication-behind-a-port-with-a-deliberately-fake.md) |
| 004 | shadcn/ui primitives are vendored, not installed | ENGINEERING_GUIDELINES.md | — | [`ADR-004-shadcnui-primitives-are-vendored-not-installed.md`](ADR-004-shadcnui-primitives-are-vendored-not-installed.md) |
| 005 | Framer Motion removed after measurement | DESIGN_SYSTEM.md | — | [`ADR-005-framer-motion-removed-after-measurement.md`](ADR-005-framer-motion-removed-after-measurement.md) |
| 006 | Brand typeface self-hosted via `@fontsource-variable` | DESIGN_SYSTEM.md | — | [`ADR-006-brand-typeface-self-hosted-via-fontsource-variable.md`](ADR-006-brand-typeface-self-hosted-via-fontsource-variable.md) |
| 007 | Server Components by default, three client islands | ARCHITECTURE.md | — | [`ADR-007-server-components-by-default-three-client-islands.md`](ADR-007-server-components-by-default-three-client-islands.md) |
| 008 | `Reveal` is polymorphic | DESIGN_SYSTEM.md | — | [`ADR-008-reveal-is-polymorphic.md`](ADR-008-reveal-is-polymorphic.md) |
| 009 | `--content-subtle` decoupled from the brand palette | DESIGN_SYSTEM.md | — | [`ADR-009-content-subtle-decoupled-from-the-brand-palette.md`](ADR-009-content-subtle-decoupled-from-the-brand-palette.md) |
| 010 | Ambient declarations for asset imports | — | — | [`ADR-010-ambient-declarations-for-asset-imports.md`](ADR-010-ambient-declarations-for-asset-imports.md) |
| 011 | Profile provisioning by a `SECURITY DEFINER` trigger, not a second application call | ARCHITECTURE.md | — | [`ADR-011-profile-provisioning-by-a-security-definer-trigger-not.md`](ADR-011-profile-provisioning-by-a-security-definer-trigger-not.md) |
| 012 | Login rate limiting lives in Postgres, not in application memory | ARCHITECTURE.md | — | [`ADR-012-login-rate-limiting-lives-in-postgres-not-in.md`](ADR-012-login-rate-limiting-lives-in-postgres-not-in.md) |
| 013 | No IP forwarded to Supabase's own rate limiting | ARCHITECTURE.md | — | [`ADR-013-no-ip-forwarded-to-supabases-own-rate-limiting.md`](ADR-013-no-ip-forwarded-to-supabases-own-rate-limiting.md) |
| 014 | `email_service_unavailable` is its own code, and a message fallback covers sign-up duplicates too | ENGINEERING_GUIDELINES.md | — | [`ADR-014-emailserviceunavailable-is-its-own-code-and-a-message.md`](ADR-014-emailserviceunavailable-is-its-own-code-and-a-message.md) |
| 015 | `signUp()` no longer trusts "no `error`" as proof of success | ENGINEERING_GUIDELINES.md | — | [`ADR-015-signup-no-longer-trusts-no-error-as-proof.md`](ADR-015-signup-no-longer-trusts-no-error-as-proof.md) |
| 016 | A third `AuthResult` state for "account created, not yet authenticated" | DOMAIN_MODEL.md | — | [`ADR-016-a-third-authresult-state-for-account-created-not.md`](ADR-016-a-third-authresult-state-for-account-created-not.md) |
| 017 | The test script now loads `.env.local`, with Node's own flag | ENGINEERING_GUIDELINES.md | — | [`ADR-017-the-test-script-now-loads-envlocal-with-nodes.md`](ADR-017-the-test-script-now-loads-envlocal-with-nodes.md) |
| 018 | `email_hash` opacity blocks unlock-by-stranger; lockout-by-stranger is reachable through the real form and is an accepted risk, not a bug | ARCHITECTURE.md | — | [`ADR-018-emailhash-opacity-blocks-unlock-by-stranger.md`](ADR-018-emailhash-opacity-blocks-unlock-by-stranger.md) |
| 019 | `getCurrentTermsVersion()` also fails open on `createClient()` throwing, not only on the RPC's `{ error }` | ARCHITECTURE.md | Refined by ADR-024 | [`ADR-019-getcurrenttermsversion-also-fails-open-on-createclient-throwing-not.md`](ADR-019-getcurrenttermsversion-also-fails-open-on-createclient-throwing-not.md) |
| 020 | Auth Server Actions never let an unexpected exception become a silent no-op; `safeAuthCall` is the one place that decides | ENGINEERING_GUIDELINES.md | — | [`ADR-020-auth-server-actions-never-let-an-unexpected-exception.md`](ADR-020-auth-server-actions-never-let-an-unexpected-exception.md) |
| 021 | Session-refresh middleware, refresh-only by design | ARCHITECTURE.md | — | [`ADR-021-session-refresh-middleware-refresh-only-by-design.md`](ADR-021-session-refresh-middleware-refresh-only-by-design.md) |
| 022 | Password reset: Confirm email decided OFF, and the flow this closes for Sprint B | PRODUCT.md | — | [`ADR-022-password-reset-confirm-email-decided-off-and-the.md`](ADR-022-password-reset-confirm-email-decided-off-and-the.md) |
| 023 | `?next=` is validated server-side before every `redirect()`, not trusted from the query string | ENGINEERING_GUIDELINES.md | — | [`ADR-023-next-is-validated-server-side-before-every-redirect.md`](ADR-023-next-is-validated-server-side-before-every-redirect.md) |
| 024 | Session-refresh middleware fails open on "missing or invalid" config, exactly ADR-019's own scope — with the two causes kept distinguishable, logged once per process | ARCHITECTURE.md | Refines ADR-019 | [`ADR-024-session-refresh-middleware-fails-open-on-missing-or.md`](ADR-024-session-refresh-middleware-fails-open-on-missing-or.md) |
| 025 | `server.ts`'s `setAll` does not apply `@supabase/ssr`'s anti-cache headers; Next's own dynamic-rendering default already does | ARCHITECTURE.md | — | [`ADR-025-servertss-setall-does-not-apply-supabasessrs-anti-cache.md`](ADR-025-servertss-setall-does-not-apply-supabasessrs-anti-cache.md) |
| 026 | Representative pages resolve by subdomain (`<slug>.<domain>`), not by path — decided before Sprint C, before a single QR code exists | DOMAIN_MODEL.md | — | [`ADR-026-representative-pages-resolve-by-subdomain-slugdomain-not-by.md`](ADR-026-representative-pages-resolve-by-subdomain-slugdomain-not-by.md) |
| 027 | Company e Representative como entidades reais; nome público do representante vive em `representatives`, não em `profiles` | DOMAIN_MODEL.md | — | [`ADR-027-company-e-representative-como-entidades-reais.md`](ADR-027-company-e-representative-como-entidades-reais.md) |
| 028 | Product e Product Activation reais; Catalog fica conceitual, não uma tabela própria | DOMAIN_MODEL.md | — | [`ADR-028-product-e-product-activation-reais.md`](ADR-028-product-e-product-activation-reais.md) |
| 029 | Uma Commercial Page por (Representative × Product); sem hub público — o hub é o `/app` privado | DOMAIN_MODEL.md | — | [`ADR-029-uma-commercial-page-por-representative-product-sem-hub.md`](ADR-029-uma-commercial-page-por-representative-product-sem-hub.md) |
| 030 | Página de representante não resolvível: `notFound()` padrão, mesma URL — não redirect cross-origin | ARCHITECTURE.md | — | [`ADR-030-pagina-de-representante-nao-resolvivel-notfound-padrao-mesma.md`](ADR-030-pagina-de-representante-nao-resolvivel-notfound-padrao-mesma.md) |
| 031 | Resolução de Representative é um port novo (`RepresentativeRepository`), distinto do `TenantRepository` do ADR-001 | ARCHITECTURE.md | — | [`ADR-031-resolucao-de-representative-e-um-port-novo-representativerepository.md`](ADR-031-resolucao-de-representative-e-um-port-novo-representativerepository.md) |
| 032 | Rota de produto vive no root (`src/app/[productSlug]/page.tsx`), não atrás de rewrite em middleware | ARCHITECTURE.md | — | [`ADR-032-rota-de-produto-vive-no-root-srcappproductslugpagetsx-nao.md`](ADR-032-rota-de-produto-vive-no-root-srcappproductslugpagetsx-nao.md) |
| 033 | Identificação do licenciado é componente estrutural; Subscription é tabela própria desde já, gerenciada manualmente até o gateway existir | DOMAIN_MODEL.md | — | [`ADR-033-identificacao-do-licenciado-e-componente-estrutural.md`](ADR-033-identificacao-do-licenciado-e-componente-estrutural.md) |
| 034 | Captura de lead via `submit_lead` (SECURITY DEFINER), reaproveitando o padrão e o salt de `login_attempts` — não um novo esquema | DOMAIN_MODEL.md | — | [`ADR-034-captura-de-lead-via-submitlead-security-definer-reaproveitando.md`](ADR-034-captura-de-lead-via-submitlead-security-definer-reaproveitando.md) |
| 035 | Link de WhatsApp construído a partir de `representative.phone`, sem novo campo/formato | DOMAIN_MODEL.md | — | [`ADR-035-link-de-whatsapp-construido-a-partir-de-representativephone.md`](ADR-035-link-de-whatsapp-construido-a-partir-de-representativephone.md) |
| 036 | `submit_lead` parava de aplicar seu próprio rate limit para qualquer chamador direto do RPC; corrigido removendo os parâmetros, não flooram com `greatest()` | ARCHITECTURE.md | — | [`ADR-036-submitlead-parava-de-aplicar-seu-proprio-rate-limit.md`](ADR-036-submitlead-parava-de-aplicar-seu-proprio-rate-limit.md) |
| 037 | Catálogo iGreen semeado por migration, com UUIDs literais fixos — não por script, não com `gen_random_uuid()` | DOMAIN_MODEL.md | — | [`ADR-037-catalogo-igreen-semeado-por-migration-com-uuids-literais.md`](ADR-037-catalogo-igreen-semeado-por-migration-com-uuids-literais.md) |
| 038 | Um representante não conseguia ler a própria linha; duas policies de SELECT por dono, sem tocar nas públicas | ARCHITECTURE.md | — | [`ADR-038-um-representante-nao-conseguia-ler-a-propria-linha.md`](ADR-038-um-representante-nao-conseguia-ler-a-propria-linha.md) |
| 039 | Ciclo de RLS entre `representatives` e `product_activations`; quebrado com `is_own_representative()` `SECURITY DEFINER` | ARCHITECTURE.md | — | [`ADR-039-ciclo-de-rls-entre-representatives-e-productactivations.md`](ADR-039-ciclo-de-rls-entre-representatives-e-productactivations.md) |
| 040 | `register_representative()`, primeira escrita self-service em `representatives`; grant só a `authenticated`, nunca a `anon` | ARCHITECTURE.md | — | [`ADR-040-registerrepresentative-primeira-escrita-self-service-em-representatives.md`](ADR-040-registerrepresentative-primeira-escrita-self-service-em-representatives.md) |
| 041 | `RepresentativeOnboardingGateway` é uma porta nova, não um método a mais em `RepresentativeRepository` | ARCHITECTURE.md | — | [`ADR-041-representativeonboardinggateway-e-uma-porta-nova-nao-um-metodo.md`](ADR-041-representativeonboardinggateway-e-uma-porta-nova-nao-um-metodo.md) |
| 042 | `/app` ramifica entre onboarding e hub por uma terceira porta, `RepresentativeAccountRepository`; sucesso do cadastro passa a navegar, não a renderizar | ARCHITECTURE.md | — | [`ADR-042-app-ramifica-entre-onboarding-e-hub-por-uma.md`](ADR-042-app-ramifica-entre-onboarding-e-hub-por-uma.md) |
| 043 | Caminho de escrita da ativação de produto por duas funções `SECURITY DEFINER`, não por policies de INSERT/UPDATE | ARCHITECTURE.md | — | [`ADR-043-caminho-de-escrita-da-ativacao-de-produto-por.md`](ADR-043-caminho-de-escrita-da-ativacao-de-produto-por.md) |
| 044 | `RepresentativeCatalogRepository`, quinta porta do módulo: leitura cruzada do Catalog da Company com as próprias Product Activations (D5.1) | ARCHITECTURE.md | — | [`ADR-044-representativecatalogrepository-quinta-porta-do-modulo-leitura-cruzada-do.md`](ADR-044-representativecatalogrepository-quinta-porta-do-modulo-leitura-cruzada-do.md) |
| 045 | Server Actions de ativação: `null` significa sucesso, e um wrapper genérico substitui um por família (D5.2) | ENGINEERING_GUIDELINES.md | — | [`ADR-045-server-actions-de-ativacao-null-significa-sucesso-e.md`](ADR-045-server-actions-de-ativacao-null-significa-sucesso-e.md) |
| 046 | Hub real substitui `RepresentativeHubPlaceholder`; o link público compõe-se de `SITE_URL`, não de uma nova leitura de hostname (D5.3) | ARCHITECTURE.md | — | [`ADR-046-hub-real-substitui-representativehubplaceholder.md`](ADR-046-hub-real-substitui-representativehubplaceholder.md) |
| 047 | `update_representative_profile`, função `SECURITY DEFINER`, não policy de UPDATE por coluna; `avatar_url` adiado (D5b) | ARCHITECTURE.md | — | [`ADR-047-updaterepresentativeprofile-funcao-security-definer-nao-policy-de-update.md`](ADR-047-updaterepresentativeprofile-funcao-security-definer-nao-policy-de-update.md) |
| 048 | `anon` tinha EXECUTE nas quatro funções self-service; `revoke ... from public` nunca foi a causa, um `ALTER DEFAULT PRIVILEGES` era | ARCHITECTURE.md | — | [`ADR-048-anon-tinha-execute-nas-quatro-funcoes-self-service.md`](ADR-048-anon-tinha-execute-nas-quatro-funcoes-self-service.md) |
| 049 | QR Code renderizado no cliente, a partir da URL já resolvida; zero migration (QR1, `docs/QR_ANALYTICS_PLAN.md` §3.1) | DESIGN_SYSTEM.md | — | [`ADR-049-qr-code-renderizado-no-cliente-a-partir-da.md`](ADR-049-qr-code-renderizado-no-cliente-a-partir-da.md) |
| 050 | `analytics_events`, tabela única de eventos crus com `ip_hash` embutido; zero função de escrita ainda (AN1, `docs/QR_ANALYTICS_PLAN.md` §3.4/§3.5) | DOMAIN_MODEL.md | — | [`ADR-050-analyticsevents-tabela-unica-de-eventos-crus-com-iphash.md`](ADR-050-analyticsevents-tabela-unica-de-eventos-crus-com-iphash.md) |
| 051 | `record_page_visit`/`record_whatsapp_click`, o caminho de escrita de `analytics_events`; resolvem por slug+slug, nunca por id (AN2 + AN4, `docs/QR_ANALYTICS_PLAN.md` §3.2/§3.6) | ARCHITECTURE.md | Corrected by ADR-052 | [`ADR-051-recordpagevisitrecordwhatsappclick-o-caminho-de-escrita-de-analyticsevents.md`](ADR-051-recordpagevisitrecordwhatsappclick-o-caminho-de-escrita-de-analyticsevents.md) |
| 052 | Correção ao ADR-051: `authenticated` tinha EXECUTE em `is_bot_user_agent`, apesar do comentário afirmar o contrário; `anon` estava correto | ARCHITECTURE.md | Corrects ADR-051 | [`ADR-052-correcao-ao-adr-051-authenticated-tinha-execute-em.md`](ADR-052-correcao-ao-adr-051-authenticated-tinha-execute-em.md) |
| 053 | `record_page_visit`/`record_whatsapp_click` chamadas do app; `after()` para a visita, rota dedicada para o clique (AN3 + AN5, `docs/QR_ANALYTICS_PLAN.md` §4) | ARCHITECTURE.md | Corrected by ADR-054 | [`ADR-053-recordpagevisitrecordwhatsappclick-chamadas-do-app.md`](ADR-053-recordpagevisitrecordwhatsappclick-chamadas-do-app.md) |
| 054 | Correção ao ADR-053: `ip_hash` de analytics passa a ter salt próprio (`ANALYTICS_IP_SALT`), não mais `LOGIN_ATTEMPT_SALT` reaproveitado | ARCHITECTURE.md | Corrects ADR-053 | [`ADR-054-correcao-ao-adr-053-iphash-de-analytics-passa.md`](ADR-054-correcao-ao-adr-053-iphash-de-analytics-passa.md) |
| 055 | Aviso "Antes de contratar" por categoria de Produto, e o disclaimer "não é canal oficial" que faltava na Commercial Page | DOMAIN_MODEL.md | — | [`ADR-055-aviso-antes-de-contratar-por-categoria-de-produto.md`](ADR-055-aviso-antes-de-contratar-por-categoria-de-produto.md) |
| 056 | "No distractions" passa a significar CTA único, não zero conteúdo; conteúdo variável por Produto vive em código; Tabs de conteúdo do Conexão Club como prova de conceito (CP3) | DESIGN_SYSTEM.md | — | [`ADR-056-no-distractions-passa-a-significar-cta-unico-nao.md`](ADR-056-no-distractions-passa-a-significar-cta-unico-nao.md) |
| 057 | Mecanismo de tokens de marca por vertical/Company, aplicado à Commercial Page da iGreen (CP9) | DESIGN_SYSTEM.md | — | [`ADR-057-mecanismo-de-tokens-de-marca-por-verticalcompany-aplicado.md`](ADR-057-mecanismo-de-tokens-de-marca-por-verticalcompany-aplicado.md) |
| 058 | Adoção formal da PRODUCT_CONSTITUTION.md v1.1 como autoridade máxima do projeto | PRODUCT_CONSTITUTION.md | Reconciled by ADR-059 | [`ADR-058-adocao-formal-da-productconstitutionmd-v11-como-autoridade-maxima.md`](ADR-058-adocao-formal-da-productconstitutionmd-v11-como-autoridade-maxima.md) |
| 059 | Reconciliação de `ARCHITECTURE.md` e `ENGINEERING_GUIDELINES.md` com a PRODUCT_CONSTITUTION.md v1.1 | ARCHITECTURE.md / ENGINEERING_GUIDELINES.md | Reconciles ADR-058 with ARCHITECTURE.md / ENGINEERING_GUIDELINES.md | [`ADR-059-reconciliacao-de-architecturemd-e-engineeringguidelinesmd-com-a-productconstitutionmd.md`](ADR-059-reconciliacao-de-architecturemd-e-engineeringguidelinesmd-com-a-productconstitutionmd.md) |
| 060 | Vocabulário oficial da plataforma: `Representative` vs. "licenciado"/`license_id` | DOMAIN_MODEL.md | Precedes ADR-061/062 | [`ADR-060-vocabulario-oficial-da-plataforma-representative-vs-licenciadolicenseid.md`](ADR-060-vocabulario-oficial-da-plataforma-representative-vs-licenciadolicenseid.md) |
| 061 | Renomeia `representatives.license_id` para `authorization_id` (Passo 7a, schema/RPC) | DOMAIN_MODEL.md | Step 7a of ADR-060; completed by ADR-062 | [`ADR-061-renomeia-representativeslicenseid-para-authorizationid-passo-7a-schemarpc.md`](ADR-061-renomeia-representativeslicenseid-para-authorizationid-passo-7a-schemarpc.md) |
| 062 | Completa o rename `license_id` → `authorization_id`: contrato RPC, domínio, componente (Passo 7b) | DOMAIN_MODEL.md | Step 7b of ADR-060; completes ADR-061 | [`ADR-062-completa-o-rename-licenseid-authorizationid-contrato-rpc-dominio.md`](ADR-062-completa-o-rename-licenseid-authorizationid-contrato-rpc-dominio.md) |
| 063 | `is_subscription_active(uuid)` + `product_activations_select_published` redefinida: enforcement de leitura da regra 21 (Passo E1) | DOMAIN_MODEL.md | — | [`ADR-063-issubscriptionactiveuuid-productactivationsselectpublished-redefinida-enforcement-de-leitura-da-regra.md`](ADR-063-issubscriptionactiveuuid-productactivationsselectpublished-redefinida-enforcement-de-leitura-da-regra.md) |
| 064 | `set_activation_status` reutiliza `is_subscription_active` no gate de publicação (Passo E2) | DOMAIN_MODEL.md | Complements ADR-063; resolves the Subscription deviation in ADR-043 | [`ADR-064-setactivationstatus-reutiliza-issubscriptionactive-no-gate-de-publicacao.md`](ADR-064-setactivationstatus-reutiliza-issubscriptionactive-no-gate-de-publicacao.md) |
| 065 | Fronteira confiável de Analytics e regra única de acesso público | ARCHITECTURE.md / DOMAIN_MODEL.md | Corrects ADR-051/053; consolidates ADR-063/064 | [`ADR-065-fronteira-confiavel-de-analytics-e-regra-unica-de-acesso-publico.md`](ADR-065-fronteira-confiavel-de-analytics-e-regra-unica-de-acesso-publico.md) |
| 066 | App Shell autenticado, invariante e prefill do perfil profissional | ARCHITECTURE.md / DOMAIN_MODEL.md / DESIGN_SYSTEM.md | Extends ADR-040/047; supersedes route composition in ADR-042/046 | [`ADR-066-app-shell-autenticado-e-invariante-do-perfil-profissional.md`](ADR-066-app-shell-autenticado-e-invariante-do-perfil-profissional.md) |
| 067 | Fronteira confiável e atomicidade da submissão de leads | ARCHITECTURE.md | Corrects ADR-034/036; follows ADR-065 | [`ADR-067-fronteira-confiavel-e-atomicidade-da-submissao-de-leads.md`](ADR-067-fronteira-confiavel-e-atomicidade-da-submissao-de-leads.md) |
| 068 | `submit_lead` passa a consumir a regra canônica de acesso público | DOMAIN_MODEL.md | Consolidates with ADR-065; follows ADR-067 | [`ADR-068-submit-lead-passa-a-consumir-a-regra-canonica-de-acesso-publico.md`](ADR-068-submit-lead-passa-a-consumir-a-regra-canonica-de-acesso-publico.md) |
| 069 | Infraestrutura mínima compartilhada de microfeedback qualitativo | ARCHITECTURE.md | Extends ADR-047; first consumer SET-61 | [`ADR-069-infraestrutura-minima-compartilhada-de-microfeedback-qualitativo.md`](ADR-069-infraestrutura-minima-compartilhada-de-microfeedback-qualitativo.md) |

## Existing code and migration comments still say `README.md`

**Known, accepted consequence of the migration — not fixed here.** At least
48 files under `src/` and `supabase/migrations/` (135 mentions) reference an
ADR by number in a comment; 11 of those explicitly name `README.md` as where
to find it. Those comments are now stale — the same problem
`docs/plans/README.md` § *Where these files used to live* already documents
for the plan-file move, for the same reason: **applied migrations are never
edited**, and this was a documentation-governance audit, not a code change.
Source code was explicitly out of scope for the migration that created this
folder.

**This does not break resolution.** Every such comment still names a real
ADR number; the index above resolves any of them in one lookup, same as
before. Tracked as debt in `docs/README.md` § *Outstanding Documentation
Debt*.

## Outstanding gaps in this log

Recorded here rather than hidden, per the same principle that governs
`docs/README.md` § *Outstanding Documentation Debt*:

- **Older ADRs do not carry a structured `Status` or `Date` field.** Retrofitting
  one onto entries that never recorded those facts would mean inventing dates
  recorded — worse than leaving the gap explicit. A structured header
  (`Status: Accepted`, `Date: YYYY-MM-DD`, `Related: ADR-NNN`) is recommended
  for every ADR written **from now on**; existing ones are not touched to
  match.
- **The normative-document mapping in this index was assigned by this audit**,
  from each ADR's content, not stated in the original text. It is a reading
  aid, not a claim the original author made. Treat it as advisory.

## Writing a new ADR

One file per decision, `docs/adr/ADR-NNN-short-slug.md`, `NNN` continuing this
series with no gaps. State: context, problem, alternatives considered,
decision, positive consequences, negative consequences, and — for every ADR
from this point forward — status and date. Add a row to the index above in
the same change.

An ADR is written when a decision is **implemented**, not when it is
proposed — a proposal belongs in `docs/plans/`. Full rule: `docs/README.md`
§ *When an ADR is required*.
