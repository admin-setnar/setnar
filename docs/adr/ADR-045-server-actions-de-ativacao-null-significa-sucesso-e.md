### ADR-045 — Server Actions de ativação: `null` significa sucesso, e um wrapper genérico substitui um por família (D5.2)
**Decisão.** `activateProductAction`/`setActivationStatusAction`/
`updateRepresentativeProfileAction` (`presentation/actions.ts`) retornam
`Failure | null` — `null` para sucesso, o tipo de falha tipado
(`ActivateProductFailure`/`SetActivationStatusFailure`/
`UpdateRepresentativeProfileFailure`) para o resto — e chamam
`revalidatePath('/app')` em vez de `redirect()`. As três compartilham um
único wrapper, `safeRepresentativeWriteCall`
(`presentation/safe-representative-write-call.ts`), genérico sobre
`T extends { status: string }`.
**Por que `null`, não a convenção "retorno normal é sempre falha" que
`registerRepresentativeAction` usa.** Aquela convenção só funciona porque o
sucesso termina em `redirect()`, que lança — o corpo da função nunca de fato
retorna um valor de sucesso para o tipo checar contra. Ativar, publicar,
despublicar e editar perfil não navegam: o hub permanece na mesma tela,
atualizado por `revalidatePath`. Devolver um valor de sucesso "encolhido" de
uma função cujo tipo de retorno EXCLUI esse variant (por exemplo,
`{status:'activated', ...}` de uma função tipada `ActivateProductFailure`)
seria uma mentira de tipo — `null` é a forma honesta de dizer "funcionou" sem
alegar que a exclusão de tipo não existe.
**Por que um wrapper genérico, não um terceiro/quarto arquivo quase
idêntico.** `safeAuthCall` e `safeOnboardingCall` são dois wrappers quase
idênticos por uma razão real e documentada: `safeOnboardingCall` é
estreitado para `T extends RegisterRepresentativeResult` especificamente
pelo problema de narrowing que `registerRepresentativeAction` tem (ver o
comentário daquele arquivo). Nenhuma das três Server Actions de escrita deste
passo tem esse problema — nenhuma redireciona — então um terceiro/quarto
arquivo copiando a mesma estrutura seria duplicação sem diferença de
comportamento para justificá-la. `safeRepresentativeWriteCall` nasceu como
`safeActivationCall` (só para D5.2) e foi generalizado e renomeado no mesmo
passo, antes de D5b reutilizá-lo, exatamente para não repetir esse corpo uma
terceira vez.
**Custo de reversão.** Baixo — três Server Actions e um wrapper
compartilhado; nenhuma migration.

**Evolução (Parte 2 da consolidação da Stage 1).** ADR-066 preserva o contrato
`Failure | null`, mas substitui a revalidação ampla de `/app`: ativação,
publicação e despublicação revalidam `/app/paginas`; a edição do perfil
revalida `/app/conta` e `/app/paginas`.
