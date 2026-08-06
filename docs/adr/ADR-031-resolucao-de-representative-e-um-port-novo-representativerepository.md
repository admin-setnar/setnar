### ADR-031 — Resolução de Representative é um port novo (`RepresentativeRepository`), distinto do `TenantRepository` do ADR-001
**Decisão.** `TenantRepository` (ADR-001) continua resolvendo Company. Um
port novo, `RepresentativeRepository`
(`src/modules/representatives/domain/representative-repository.ts`),
resolve subdomínio de Representative — `extractRepresentativeSlug`
(`src/modules/representatives/application/resolve-representative.ts:89-110`)
extrai o label antes do domínio conhecido do `Host`, consulta
`representatives`/`product_activations` no Supabase (RLS já filtra pra
linhas públicas, ver ADR-027/028). Resolução de Company é sempre tentada
primeiro; só tenta Representative se isso não bater — cobre
`setnar.com`, `www.setnar.com`, `localhost`
(`src/modules/tenancy/infrastructure/tenants/setnar.tenant.ts:16`) e
previews `*.vercel.app` por construção, sem precisar excluí-los
individualmente no parsing. **Por quê dois ports, não um.** Naturezas
diferentes — lista pequena e fixa em memória vs. dinâmica e ilimitada em
banco. **Custo de reversão.** Baixo — isolado atrás do port, como o
próprio ADR-001 já previa.
