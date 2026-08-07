import type { ValuePerceptionResponse } from '@/modules/feedback/domain/feedback';

/**
 * SET-62's fixed question/options for `context: 'value_perception'`, shared
 * by both call sites that can render this prompt (`/app/paginas` via
 * `RepresentativeHub`, `/app/conta` directly) — kept in one place so the two
 * screens cannot drift into asking a differently-worded question. Typed as
 * `ValuePerceptionResponse` for compile-time protection against a typo
 * drifting from `resolve_feedback`'s `value_perception` allow-list, same
 * reasoning `RepresentativeHub`'s own `FIRST_PUBLICATION_FEEDBACK_OPTIONS`
 * already documents for SET-61.
 */
export const VALUE_PERCEPTION_FEEDBACK_QUESTION = 'A SETNAR está ajudando você a divulgar seu trabalho?';

export const VALUE_PERCEPTION_FEEDBACK_OPTIONS: ReadonlyArray<{ value: ValuePerceptionResponse; label: string }> = [
  { value: 'yes', label: 'Sim' },
  { value: 'partly', label: 'Em parte' },
  { value: 'no', label: 'Não' },
];

/** Both "Em parte" and "Não" reveal the optional complementary field; only "Sim" resolves immediately. */
export const VALUE_PERCEPTION_OPTIONS_WITH_DETAIL: readonly ValuePerceptionResponse[] = ['partly', 'no'];

export const VALUE_PERCEPTION_DETAIL_LABEL = 'O que está faltando? (opcional)';
