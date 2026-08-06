# SETNAR — Instruções para agentes de desenvolvimento

## Autoridade da tarefa

Toda implementação deve estar vinculada a uma Issue aprovada do Linear.

A Issue define:

- objetivo;
- escopo;
- critérios de aceite;
- exclusões;
- projeto e prioridade.

Não implemente trabalho que não esteja autorizado pela Issue.

## Ordem obrigatória antes de alterar código

1. Leia integralmente a Issue do Linear fornecida no prompt.
2. Inspecione o estado real do repositório.
3. Leia os documentos normativos relevantes.
4. Leia as ADRs relacionadas.
5. Identifique dependências, migrations e riscos.
6. Informe inconsistências antes de implementar.
7. Não confie apenas em relatórios anteriores.

## Fontes da verdade

A documentação oficial vive no repositório.

Ordem de autoridade:

1. `docs/PRODUCT_CONSTITUTION.md`
2. ADRs aceitas
3. `docs/PRODUCT.md`
4. `docs/ARCHITECTURE.md`
5. `docs/DOMAIN_MODEL.md`
6. `docs/DESIGN_SYSTEM.md`
7. `docs/ROADMAP.md`
8. planos ativos
9. Issue do Linear

Quando houver conflito, não improvise. Registre o conflito e solicite decisão.

## Limites de escopo

- Não implemente funcionalidades fora da Issue.
- Não faça refatorações oportunistas.
- Não altere decisões de produto implicitamente.
- Não introduza dependências sem necessidade comprovada.
- Não modifique migrations já aplicadas.
- Não altere contratos públicos sem avaliar compatibilidade.
- Não transforme ideias futuras em código do MVP.
- Não marque uma Issue como concluída.

Bugs encontrados fora do escopo devem ser relatados separadamente.

## Arquitetura

Preserve as fronteiras existentes entre:

- domínio;
- aplicação;
- infraestrutura;
- apresentação.

Regras de negócio não devem ser duplicadas em componentes visuais, Server Actions ou gateways.

Antes de criar abstrações novas, procure implementações e padrões equivalentes no projeto.

## Banco de dados

Para qualquer mudança de banco:

- crie migration nova;
- preserve migrations existentes;
- avalie RLS;
- avalie atomicidade;
- avalie rollback;
- use banco descartável para validação quando necessário;
- documente testes manuais pendentes.

Nunca use o banco de produção para experimentação.

## Qualidade

Antes de finalizar:

1. Execute `npm run verify`.
2. Execute testes específicos da área modificada.
3. Revise o diff completo.
4. Verifique regressões.
5. Verifique responsividade quando houver interface.
6. Verifique estados de loading, vazio, erro e sucesso.
7. Verifique acessibilidade relevante.
8. Informe tudo que não pôde ser validado.

## Git

Use o identificador da Issue do Linear.

Branch:

`set-123-descricao-curta`

Commit:

`feat(scope): descrição [SET-123]`

Pull request:

`SET-123 — Título da Issue`

Cada PR deve representar apenas uma Issue principal.

## Relatório final obrigatório

Ao concluir o trabalho, apresente:

1. Resultado: GO, NO-GO ou GO com ressalvas.
2. Resumo da implementação.
3. Arquivos alterados.
4. Decisões tomadas.
5. Testes executados e resultados.
6. Testes manuais pendentes.
7. Migrations criadas ou aplicadas.
8. Riscos e limitações.
9. Itens encontrados fora do escopo.
10. Correspondência entre critérios de aceite e evidências.

Não afirme que algo foi validado sem evidência.