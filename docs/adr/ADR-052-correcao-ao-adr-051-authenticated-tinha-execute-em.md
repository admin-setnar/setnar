### ADR-052 — Correção ao ADR-051: `authenticated` tinha EXECUTE em `is_bot_user_agent`, apesar do comentário afirmar o contrário; `anon` estava correto
**O ADR-051 (acima) está errado na metade.** Ele afirma que
`is_bot_user_agent` "não é concedido a anon/authenticated". O double-check
de grants que o próprio AN2/AN4 exigia (`information_schema.role_routine_grants`)
mostrou `authenticated` com EXECUTE nessa função — só `anon` estava correto,
confirmado também por RPC HTTP cru sem `Authorization`
(`401 42501 permission denied`, o resultado certo). Mesmo padrão do ADR-039
corrigindo um comentário errado de `20260804000000`: a migration antiga
(`20260811000000`) não é editada (regra do README.md); esta entrada é a
correção registrada.
**Causa raiz — mesma classe do ADR-048, papel diferente.** `revoke ...
from public` funcionou (por isso `anon` estava certo — o
`alter default privileges ... revoke execute on functions from anon` do
ADR-048 fechou especificamente o default de `anon` deste projeto). Mas
aquela correção nunca tocou `authenticated`: este projeto Supabase tem (tinha)
um default privilege próprio concedendo EXECUTE a `authenticated` em toda
função nova — mesmo mecanismo do ADR-048 (`ALTER DEFAULT PRIVILEGES`, não um
`grant` explícito), só que para o papel que, para as quatro funções
originais do ADR-048, era o acesso CORRETO — por isso nunca foi fechado até
agora, quando uma função (`is_bot_user_agent`) que não deveria ter
`authenticated` nenhum expôs o gap.
**Risco real, avaliado como baixo.** `is_bot_user_agent` não lê tabela, não
muta nada, devolve só um `boolean` sobre o próprio parâmetro — nenhum dado
vaza por essa concessão. Corrigido mesmo assim porque a documentação
afirmava um comportamento que não era o real, e esse é exatamente o tipo de
divergência que o ADR-048 existe para não deixar passar.
**Correção.** Nova migration
(`20260812000000_revoke_authenticated_from_is_bot_user_agent.sql`):
`revoke execute on function public.is_bot_user_agent(text) from
authenticated`. `record_page_visit`/`record_whatsapp_click` não são tocadas
— `authenticated` nelas é o público pretendido (ADR-051), não um vazamento.
**Custo de reversão.** Baixo — um `revoke` a mais, nenhum dado tocado.
