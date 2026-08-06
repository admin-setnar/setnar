### ADR-050 — `analytics_events`, tabela única de eventos crus com `ip_hash` embutido; zero função de escrita ainda (AN1, `docs/QR_ANALYTICS_PLAN.md` §3.4/§3.5)
**Decisão.** Nova migration
(`supabase/migrations/20260810000000_add_analytics_events.sql`) cria
`analytics_events` (`representative_id`, `product_id`, `event_type` check
`'visit'`/`'whatsapp_click'`, `referrer` nullable, `ip_hash`, `created_at`),
`RLS enabled`, zero policies de escrita, e uma policy de SELECT por dono
(`analytics_events_select_own`, via `is_own_representative()` do ADR-039).
Nenhuma função `SECURITY DEFINER` é criada — `record_page_visit`/
`record_whatsapp_click` são AN2/AN4, passos seguintes; até lá não existe
nenhum caminho de escrita, nem anônimo nem autenticado.
**`representative_id`/`product_id` são os dois NOT NULL — diferente de
`leads.product_id` (nullable).** A regra 13 do `DOMAIN_MODEL.md` exige que
todo Analytics/Visitor Event referencie exatamente uma Commercial Page ou
uma Campaign, nunca nenhuma. Como Commercial Page é o par Representative ×
Product (ADR-029) e Campaign ainda não existe (Stage 2), "exatamente uma
Commercial Page" só é satisfeito com os dois campos presentes — deixar
`product_id` nullable, espelhando `leads`, abriria uma linha sem Commercial
Page nenhuma, o que a regra 13 e a constraint 7 (`DOMAIN_MODEL.md` §17)
proíbem.
**`ip_hash` mora na própria tabela, não numa tabela irmã de rate-limit.**
Diferente de `leads`/`lead_submission_attempts`, aqui a mesma linha cumpre
as duas funções — é o dado reportável (o evento) e a chave de rate-limit da
futura `record_page_visit`/`record_whatsapp_click` — porque não há, para
analytics, o par "dado de negócio permanente" / "artefato descartável" que
justificou separar as duas tabelas do lead capture. A purga de `ip_hash`
(AN7, `docs/QR_ANALYTICS_PLAN.md` §4, ainda em aberto) decidirá depois se
anula só a coluna ou descarta a linha inteira — o schema não precisa mudar
para nenhuma das duas.
**Policy de SELECT reaproveita `is_own_representative()`** em vez de
inlinar pela terceira vez o `exists (select 1 from representatives r ...)`
que `leads_select_own` já usa. Não reabre o ciclo de RLS do ADR-039: aquele
ciclo precisava de duas arestas (`representatives_select_public` ⇄
`product_activations_select_own`); `analytics_events` só tem a aresta de
saída, sem nenhuma policy de `representatives`/`product_activations`
referenciando-a de volta.
**Teste.** `tests/analytics-events-select-policy.integration.test.ts` cobre
o lado anônimo (sem recursão/relação ausente, zero linhas para `anon`).
Isolamento real entre dois representantes e o exercício do `check` de
`event_type` por um chamador real **não são automatizáveis neste passo**:
sem AN2/AN4 não existe nenhum caminho de escrita (nem pela chave
publicável, nem por falta de service role key para semear dado direto) —
mesma limitação que `register-representative.integration.test.ts` já
documenta para outra tabela. O `check` de `event_type` é verificado
manualmente via SQL Editor (`supabase/README.md`, passo 14), que ignora RLS
mas nunca ignora CHECK/FK; o isolamento entre representantes fica para o
roteiro de AN2/AN4, quando houver linha real para testar contra.
**Custo de reversão.** Baixo — migration só de schema, nenhuma linha
existe ainda (a tabela não tem caminho de escrita nenhum).
