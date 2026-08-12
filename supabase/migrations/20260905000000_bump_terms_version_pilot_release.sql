-- ============================================================================
-- Bump terms version: MVP/pilot release of /termos and /privacidade (SET-45).
--
-- Content change in this release: removed the "pending legal review" notice
-- (founder decision — formal legal review deferred to before commercial
-- scale-up, tracked as SET-74) and corrected the privacy page's retention
-- copy, which still described the automatic purge job (SET-73/ADR-086) as
-- "being implemented" after it had already shipped.
-- ============================================================================

create or replace function public.current_terms_version()
returns text
language sql
immutable
as $$
  select '2026-08-12'::text;
$$;
