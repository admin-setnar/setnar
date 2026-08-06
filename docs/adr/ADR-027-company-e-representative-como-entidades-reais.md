### ADR-027 — Company e Representative como entidades reais; nome público do representante vive em `representatives`, não em `profiles`
**Decisão.** Tabelas `companies` e `representatives`
(`supabase/migrations/20260731000000_create_representative_domain.sql`),
com `representatives.profile_id` referenciando `profiles(id)` — réplica da
distinção User/Representative de `DOMAIN_MODEL.md` §7.1/§7.3. O nome
público exibido na Commercial Page é `representatives.display_name`
(`20260731000000_create_representative_domain.sql:175`), não um join com
`profiles.full_name`: `profiles_select_own`
(`20260728000000_create_profiles.sql:27-29`, `auth.uid() = id`) nunca
permitiu leitura pública, e abrir essa policy exporia a linha inteira de
`profiles` (`tenant_id`/`terms_accepted_at`/`terms_version` junto), mais
superfície que o necessário pra expor um nome. Todo outro campo público
(`phone`/`city`/`avatar_url`/`license_id`,
`20260731000000_create_representative_domain.sql:176-179`) já vivia em
`representatives` — o join era a única exceção, agora deixa de ser.
`profiles.full_name` continua existindo como o nome "de cadastro" (usado
em `/app`). **Alternativas rejeitadas.** Ampliar `profiles_select_own` ou
criar uma função `SECURITY DEFINER` só pra esse campo — rejeitadas por
abrir mais superfície do que denormalizar uma coluna que já seguia esse
padrão em todo o resto da tabela. **Custo de reversão.** Médio — sem dado
real de produção ainda, mas uma migração de dados de verdade seria
necessária mais tarde.
