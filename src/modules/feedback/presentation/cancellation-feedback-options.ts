import type { CancellationResponse } from '@/modules/feedback/domain/feedback';
import type { FeedbackPromptOption } from '@/shared/ui/feedback-prompt';

/**
 * SET-63's fixed question/options for `context: 'cancellation'`, shown once
 * on `/app/conta`'s cancellation confirmation screen — see
 * `resolve-cancellation-feedback-eligibility.ts` for when. The 9 categories
 * are the product brief's own vocabulary (issue § Escopo), each one a
 * structured, comparable value `resolve_feedback` validates
 * (`supabase/migrations/20260902000000_add_cancellation_feedback_event.sql`).
 */
export const CANCELLATION_FEEDBACK_QUESTION = 'Qual foi o motivo principal do cancelamento?';

export const CANCELLATION_FEEDBACK_OPTIONS: ReadonlyArray<
  FeedbackPromptOption & { readonly value: CancellationResponse }
> = [
  { value: 'not_generating_results', label: 'Não estou gerando resultados' },
  { value: 'not_using_enough', label: 'Não uso o suficiente' },
  { value: 'price', label: 'Preço não compensa' },
  {
    value: 'missing_feature',
    label: 'Falta funcionalidade',
    detailLabel: 'Qual funcionalidade estava faltando? (opcional)',
  },
  { value: 'hard_to_configure', label: 'Achei difícil configurar/usar' },
  { value: 'no_longer_need', label: 'Não preciso mais desse tipo de solução' },
  {
    value: 'technical_problem',
    label: 'Problema técnico',
    detailLabel: 'Conte brevemente o que aconteceu. (opcional)',
  },
  {
    value: 'expected_something_else',
    label: 'Esperava outra coisa',
    detailLabel: 'Conte brevemente o que aconteceu. (opcional)',
  },
  { value: 'other', label: 'Outro', detailLabel: 'Conte brevemente o que aconteceu. (opcional)' },
];

/**
 * Only these four reveal the optional complementary field — the other five
 * categories are self-explanatory and resolve in the single click
 * DESIGN_SYSTEM.md's *Product Application Experience* asks for.
 */
export const CANCELLATION_OPTIONS_WITH_DETAIL: readonly CancellationResponse[] = [
  'missing_feature',
  'technical_problem',
  'expected_something_else',
  'other',
];
