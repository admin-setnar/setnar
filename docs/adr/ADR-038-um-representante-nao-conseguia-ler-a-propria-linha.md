### ADR-038 — Um representante não conseguia ler a própria linha; duas policies de SELECT por dono, sem tocar nas públicas
**Decisão.**
`supabase/migrations/20260804000000_add_own_row_select_policies.sql` cria
`representatives_select_own` (`using (profile_id = auth.uid())`) e
`product_activations_select_own` (`exists` escopado por
`representatives.profile_id = auth.uid()`). Só policies — nenhuma tabela,
coluna, função ou dado. Passo D2 de `docs/SPRINT_D_PLAN.md`.
**A lacuna, encontrada auditando o schema e não relatada por ninguém.** Todas
as policies que `20260731000000` criou nessas duas tabelas são de leitura
pública, feitas para o visitante anônimo de uma Commercial Page — e o efeito
disso é mais forte do que "faltou uma policy": `representatives_select_public`
(`20260731000000:257-267`) é a **única** policy de SELECT em
`representatives`, e exige `status = 'active'` **E** existir ao menos uma
`product_activations` com `status = 'published'`. Um representante
recém-criado não tem ativação nenhuma, logo não satisfaz a policy, logo
`select * from representatives` **com a sessão dele devolve zero linhas,
inclusive a dele mesmo**. Qualquer tela de `/app` que precise saber "quem sou
eu como representante" era impossível antes desta migration. O mesmo um nível
abaixo: `product_activations_select_published`
(`20260731000000:244-246`) expõe só `published`, enquanto a tela de ativação
precisa listar exatamente o que essa policy esconde (`draft`/`unpublished`).
**Por que adicionar não afraca a leitura pública.** Policies permissivas (o
padrão; nenhuma aqui é `as restrictive`) se somam com OR — uma linha é visível
se qualquer policy de SELECT permitir. As duas novas acrescentam um caminho
disjunto para o dono, sem alterar as públicas. E não abrem nada para o
anônimo: sem sessão `auth.uid()` é null, então `profile_id = auth.uid()` é
NULL (nunca true) e o `exists` não casa com linha nenhuma.
**Por que o formato de `leads_select_own`, copiado.** `product_activations`
não tem `profile_id` próprio, e não deve ter: duplicar a identidade ali
criaria uma segunda fonte de verdade sobre a quem a ativação pertence,
capaz de divergir de `representative_id`. A pergunta é idêntica à de
`leads_select_own` (`20260731000000:314-323`) e atravessa a mesma junção, então
a policy é a mesma forma, não uma invenção nova.
**Por que uma migration própria, antes de existir qualquer tela.** É adição
pura, revisável isoladamente, e vale independentemente de como o
Representative passa a ser criado — decisão do `docs/SPRINT_D_PLAN.md` §3
(fechada: onboarding explícito pós-login, passo D3, **ainda não
implementado**).
**Verificação manual obrigatória, as duas pontas.** Ver `supabase/README.md`,
passo 8: a primeira ponta prova que a policy funciona (representante sem
ativação publicada passa a ver a própria linha, onde antes via zero); a
segunda prova que ela não vazou (a sessão de um representante continua vendo
zero linhas do outro). A segunda é a que importa e é a que um teste de
caminho feliz não pegaria.
**Custo de reversão.** Baixo — duas policies, `drop policy` desfaz.
**Correção posterior.** O corpo de `product_activations_select_own` criado
aqui foi substituído por `20260805000000_fix_rls_policy_cycle.sql` — ver
ADR-039. Esta migration continua exatamente como foi aplicada; nada aqui foi
editado.
