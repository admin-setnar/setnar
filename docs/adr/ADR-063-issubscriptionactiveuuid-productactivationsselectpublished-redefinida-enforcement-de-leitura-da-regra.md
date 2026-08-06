### ADR-063 — `is_subscription_active(uuid)` + `product_activations_select_published` redefinida: enforcement de leitura da regra 21 (Passo E1)

**Decisão.** `supabase/migrations/20260815000000_add_subscription_enforcement.sql`
cria `is_subscription_active(p_representative_id uuid)`, `security definer`,
`stable`, `language plpgsql`, `set search_path = public`, `revoke ... from
public` + `grant execute` para **`anon` e `authenticated`**, e redefine
`product_activations_select_published` (`drop policy` + `create policy`,
mesmo padrão do ADR-039) somando
`and is_subscription_active(product_activations.representative_id)` ao
predicado existente. Passo E1 de `docs/SPRINT_E_PLAN.md` §4 — o plano fica
no repositório, congelado como investigação, e este ADR é quem registra o
que foi de fato implementado.

**A lacuna que fecha.** `ADR-043` já registrava, como desvio consciente, que
o gate de publicação (`set_activation_status`) não checava Subscription —
"é D7, fora deste elo". Mas mesmo fechando esse gate de **escrita** (passo
E2, ainda não implementado), a regra 21 (`docs/DOMAIN_MODEL.md:595`) diz que
a Commercial Page deve **continuar** Published enquanto a Subscription
estiver Active — um enforcement de **leitura**, que não existia por nenhum
caminho. Sem este ADR, uma Subscription que caísse depois de já publicado
nunca tiraria a página do ar.

**Por que a policy, e não a aplicação (`findPublishedActivation`).**
Decisão do Pedro, `SPRINT_E_PLAN.md` §3.2, Opção A. A policy já é a fonte
única da verdade sobre o que é público neste projeto — o comentário do
próprio `SupabaseRepresentativeRepository` é explícito que os `.eq()` ali
são defesa em profundidade, não a filtragem real. Checar na aplicação
duplicaria a regra de visibilidade em dois lugares (a policy, que vale para
qualquer consumidor PostgREST; e o adapter, que vale só para o Next.js) —
um dos dois ficaria desatualizado primeiro, sem ninguém notar até um
vazamento.

**Por que não reabre o ciclo 42P17 do ADR-039.** Aquele ciclo era
`representatives` ⇄ `product_activations`, as duas com policy de SELECT
consultando a outra. `is_subscription_active` lê só `subscriptions`, que
tem RLS habilitado e **zero policies** desde `20260731000000` — não há
policy nenhuma para o Postgres expandir dentro do `exists` desta função,
logo não há aresta de volta. Mesmo mecanismo do ADR-039
(`security definer` roda como dono, fora de RLS), aplicado a um par de
tabelas que nunca teve o problema.

**Por que `grant ... to anon`, diferente das quatro funções do ADR-048.**
Aquelas (`register_representative`, `activate_product`,
`set_activation_status`, `update_representative_profile`) são caminhos de
escrita self-service — `anon` nunca deveria alcançá-las, e o vazamento era
o bug. `is_subscription_active` é o oposto: **precisa** valer para o
visitante anônimo, porque é chamada de dentro de uma policy de leitura
pública. Mesmo padrão de concessão de `is_login_blocked`/`is_bot_user_agent`
— funções auxiliares chamadas fora de sessão, não pontos de escrita.

**Nenhuma linha de Subscription nasce no onboarding.** Decisão do Pedro,
`SPRINT_E_PLAN.md` §3.1, Opção B — `register_representative` não muda nesta
nem em nenhuma migration futura prevista. Ausência de linha em
`subscriptions` para um `representative_id` já significa "não ativa" por
definição de `exists`: "nunca assinou" e "assinou e foi suspenso" são
indistinguíveis olhando só para a ausência de linha, mas
`is_subscription_active` trata os dois exatamente igual (`false`), que é o
único comportamento que este enforcement precisa hoje. Uma UI que precise
diferenciar os dois textualmente é trabalho futuro, não uma migração de
dado.

**`product_activations.status` não é reescrito.** Uma subscription que cai
faz a linha sumir da visibilidade pública; ela continua `'published'` no
banco, e `published_at` não é tocado. Coerente com a semântica que o
ADR-043 já fixou para `published_at` (irreversível não se justifica sem
consumidor) — se um job real existir um dia (Stage 4), ele pode flipar
`status` para `unpublished` por cima disso sem conflito.

**`representatives_select_public` não é tocada.** Continua exigindo só
`status = 'active'` e uma `product_activations` `published` via `exists`
próprio — não herda o novo predicado desta migration, porque o `exists` de
uma policy roda com os privilégios da policy que ele expande, não repete a
policy de SELECT da tabela referenciada. O efeito prático já é o desejado
sem tocar nela: `findPublishedActivation` depende da leitura de
`product_activations` que esta migration bloqueia, então a página para de
resolver de qualquer forma — mas isso é observação, não prova, e o roteiro
de verificação do `supabase/README.md` (passo 17) existe para confirmar
contra o banco real, não só por leitura de código.

**O que esta migration NÃO faz.** Não fecha o gate de **escrita** — passo
E2, migration separada, ainda não implementada; `set_activation_status`
continua sem checar Subscription. Não cria nenhuma linha em `subscriptions`
para representantes existentes. Não muda `ProductActivationCard` nem
nenhum código de aplicação — passo E4.

**Teste.** Nenhum teste automatizado exercita RLS contra um banco real neste
repositório (mesma lacuna aceita nos ADRs 038/039). Verificação manual em
`supabase/README.md`, passo 17 — ainda pendente de execução contra o
projeto real.

**Custo de reversão.** Baixo — `drop policy` + recriar sem o predicado, e
`drop function`. Nenhuma tabela, coluna ou linha existente é tocada.

---
