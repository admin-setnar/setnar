'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import type { FeedbackContext } from '@/modules/feedback/domain/feedback';
import { FEEDBACK_DETAIL_MAX_LENGTH } from '@/modules/feedback/domain/feedback';
import { recordFeedbackShownAction, resolveFeedbackAction } from '@/modules/feedback/presentation/actions';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';

export interface FeedbackPromptOption {
  readonly value: string;
  readonly label: string;
  /**
   * Overrides the prompt-level `detailLabel` for this specific option's
   * complementary field — SET-63's "Qual funcionalidade estava faltando?"
   * (missing_feature) is a different question from its "Conte brevemente o
   * que aconteceu." (technical_problem/expected_something_else/other), so a
   * single shared `detailLabel` (SET-61/62's shape, one label for every
   * option in `optionsWithDetail`) is not expressive enough once a context
   * needs more than one wording. Falls back to `detailLabel` when unset —
   * SET-61/62 never set this and keep working unchanged.
   */
  readonly detailLabel?: string;
}

/**
 * FeedbackPrompt — SET-60's one reusable microfeedback card. Promoted here
 * from `modules/feedback/presentation/` on SET-62, its second real consumer
 * (`modules/feedback/presentation/feedback-prompt.tsx`'s own former doc
 * comment flagged this move in advance) — `README.md`'s promotion posture
 * ("check it does not already exist") only bites once a second caller needs
 * the same thing, and SET-61 was the only one until now.
 *
 * Deliberately NOT a modal (DESIGN_SYSTEM.md § *Notifications*: "avoid modal
 * dialogs unless absolutely necessary") and NOT wired to `revalidatePath` —
 * everything here is client-local: the parent Server Component already
 * decided to render this prompt because the context was unresolved at
 * request time, and once resolved this component simply removes itself,
 * exactly like `LogoutButton`'s own "server owns the data, client owns only
 * pending/error" split already used elsewhere in the product app.
 *
 * `optionsWithDetail`, when set, lists every option value that reveals the
 * optional complementary field instead of resolving immediately — every
 * other option resolves in the single click DESIGN_SYSTEM.md's *Product
 * Application Experience* asks for. A list, not a single value: SET-61 only
 * ever needed one ("difficult"), but SET-62 needs two ("partly" and "no"),
 * and there is no reason the vocabulary stays capped at one going forward.
 */
export function FeedbackPrompt({
  context,
  question,
  options,
  optionsWithDetail,
  detailLabel,
}: {
  context: FeedbackContext;
  question: string;
  options: readonly FeedbackPromptOption[];
  optionsWithDetail?: readonly string[];
  detailLabel?: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [pending, setPending] = useState(false);

  // Marks the prompt as delivered exactly once per mount — the component
  // only ever mounts when the server already determined the context is
  // unresolved, so there is nothing to branch on here besides "fire it".
  useEffect(() => {
    void recordFeedbackShownAction(context);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (hidden) return null;

  async function resolve(outcome: 'answered' | 'dismissed', response: string | null, responseDetail: string | null) {
    setPending(true);
    try {
      const result = await resolveFeedbackAction(context, outcome, response, responseDetail);
      if (result.status === 'updated') {
        setThankYou(true);
        window.setTimeout(() => setHidden(true), 1600);
      } else {
        // A rejection here (already resolved / not shown) means another tab
        // or a stale render already settled this prompt — hide quietly
        // rather than show a confusing error for something the user did
        // not do wrong.
        setHidden(true);
      }
    } finally {
      setPending(false);
    }
  }

  function handleOptionClick(option: FeedbackPromptOption) {
    if (optionsWithDetail?.includes(option.value)) {
      setExpandedOption(option.value);
      return;
    }
    void resolve('answered', option.value, null);
  }

  if (thankYou) {
    return (
      <Card variant="outlined" padding="sm" role="status" className="text-content-muted">
        <Text as="p" variant="caption">
          Obrigado!
        </Text>
      </Card>
    );
  }

  return (
    <Card variant="outlined" padding="sm" className="relative space-y-3 pr-10">
      <button
        type="button"
        aria-label="Dispensar"
        disabled={pending}
        onClick={() => void resolve('dismissed', null, null)}
        className="absolute right-3 top-3 rounded-sm p-1 text-content-subtle transition-colors duration-fast hover:bg-surface-sunken hover:text-content"
      >
        <X size={16} aria-hidden="true" />
      </button>

      <Text as="p" variant="caption" className="font-medium text-content">
        {question}
      </Text>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            aria-pressed={expandedOption === option.value}
            onClick={() => handleOptionClick(option)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {expandedOption ? (
        <div className="space-y-2">
          <label htmlFor={`feedback-detail-${context}`} className="text-sm text-content-muted">
            {options.find((option) => option.value === expandedOption)?.detailLabel ??
              detailLabel ??
              'Quer contar mais? (opcional)'}
          </label>
          <div className="flex gap-2">
            <input
              id={`feedback-detail-${context}`}
              value={detail}
              maxLength={FEEDBACK_DETAIL_MAX_LENGTH}
              disabled={pending}
              onChange={(event) => setDetail(event.target.value)}
              className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-content outline-none focus:ring-2"
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={pending}
              onClick={() => void resolve('answered', expandedOption, detail)}
            >
              Enviar
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
