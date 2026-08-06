### ADR-039 — Ciclo de RLS entre `representatives` e `product_activations`; quebrado com `is_own_representative()` `SECURITY DEFINER`
**Decisão.** `supabase/migrations/20260805000000_fix_rls_policy_cycle.sql`
cria `is_own_representative(p_representative_id uuid)`, `security definer`,
`stable`, `set search_path = public` — encapsula exatamente o `exists`
(`representatives.profile_id = auth.uid()`) que estava inline em
`product_activations_select_own` (ADR-038) — e recria essa policy sobre a
função. Nenhuma migration já aplicada foi editada (regra do topo desta
seção); `20260804000000` permanece intacta.
**O bug, reproduzido nas duas pontas antes de qualquer linha desta migration
ser escrita.** Depois de `20260803000000` + `20260804000000` aplicadas,
consultas via PostgREST com a chave publicável (RLS de verdade — nunca o SQL
Editor, que conecta como dono e ignora RLS) devolveram `HTTP 500`,
`{"code":"42P17", "message":"infinite recursion detected in policy for
relation \"representatives\""}` em `GET /rest/v1/representatives` e o mesmo
código em `product_activations`. Reproduzido tanto **anônimo** (sem sessão,
só a chave publicável) quanto **autenticado** (JWT real de um usuário criado
pelo fluxo de signup) — os dois caminhos batem no mesmo 42P17; controles na
mesma sessão (`profiles`, `products`/`companies`) continuaram `200`, então o
erro é do ciclo, não da sessão nem da chave. `leads` também falhava, por
tabela vizinha: `leads_select_own` consulta `representatives`, que arrasta o
ciclo inteiro junto.
**O ciclo.** `representatives_select_public` (`20260731000000:257-267`) já
consultava `product_activations` dentro do seu `exists`;
`product_activations_select_own` (`20260804000000`) passou a consultar
`representatives` dentro do dela — cada tabela ganhou uma policy de SELECT
que depende da outra, e o Postgres aborta com `42P17` em vez de expandir
para sempre. `representatives_select_public` já estava em produção e
funcionava sozinha; `product_activations_select_own` é a metade nova, então é
ela que sai do caminho.
**Correção de documentação — `20260804000000` (ADR-038) estava errada num
ponto.** O comentário daquela migration (linhas 76-80) afirmava que "RLS não
se aplica dentro do `exists` de uma policy (a subconsulta roda com os
privilégios da própria policy)". Isso é falso — o próprio 42P17 é a prova
direta: a única forma de a expansão da policy de `representatives` alcançar a
de `product_activations` (e voltar) é RLS **sendo** aplicada dentro da
subconsulta. RLS se aplica a toda tabela referenciada na expressão de uma
policy, recursivamente, para qualquer papel sem `BYPASSRLS`. Consequência de
segunda ordem, registrada porque é real e não hipotética: `leads_select_own`
(`20260731000000:314-323`) nunca funcionou como aquele comentário supunha —
antes de `20260804000000`, um representante sem ativação publicada não
satisfazia `representatives_select_public` e por isso não conseguia ler os
próprios leads; `representatives_select_own` fechou essa lacuna de lado, por
acidente. Nada foi alterado em `leads` por causa disso — só registrado,
porque o comportamento resultante já é o desejado.
**Por que uma função `SECURITY DEFINER` quebra o ciclo.** `SECURITY DEFINER`
roda como o dono da função — o mesmo dono das tabelas — e o dono não está
sujeito a RLS (nenhuma tabela aqui usa `force row level security`). A
checagem em `representatives` deixa de ser uma referência a `representatives`
DENTRO da expressão da policy de `product_activations`: some do plano da
consulta, e com ela o ciclo. Mesmo mecanismo de ADR-011/ADR-012, usado
deliberadamente. Quebrar UM dos dois lados basta. `language plpgsql`
(não `sql`) segue a consistência já usada em `submit_lead`/`handle_new_user`
— deliberadamente sem apoiar essa escolha na alegação (falsa, verificada
contra este mesmo banco: `is_login_blocked` é `language sql` + `security
definer` sobre uma tabela com RLS e zero policies, e os testes de
ADR-017/ADR-018 provam que ela bloqueia) de que uma função `language sql`
seria inlined pelo planner e perderia o bypass — o planner recusa inline de
função `prosecdef`, então essa justificativa não se sustentaria de qualquer
forma.
**Regra operacional que sai daqui, e que vale para D4 em diante.** Nenhuma
policy nova pode ter `USING`/`WITH CHECK` que consulte uma tabela cujas
próprias policies consultem de volta a tabela original. Se a checagem
precisar atravessar essa aresta, encapsule em uma função `SECURITY DEFINER`
— nunca inline o `exists` cruzado direto na policy.
**Verificação.** `tests/rls-policy-cycle.integration.test.ts` — vermelho
antes desta migration, verde depois. Deliberadamente só o caminho anônimo
(42P17 é levantado na expansão do plano, antes de qualquer linha ser
casada — `auth.uid()` nulo não enfraquece a checagem), para não criar uma
linha descartável em `auth.users` a cada rodada de CI.
**Custo de reversão.** Baixo — uma função e uma policy recriada sobre ela;
o efeito pretendido por ADR-038 não muda.
