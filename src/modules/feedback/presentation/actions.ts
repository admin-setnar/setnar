'use server';

import type { FeedbackContext, FeedbackOutcome } from '@/modules/feedback/domain/feedback';
import type { RecordFeedbackShownResult, ResolveFeedbackResult } from '@/modules/feedback/domain/feedback-gateway';
import { getFeedbackGateway } from '@/modules/feedback/infrastructure/feedback-gateway-factory';
import { safeFeedbackCall } from '@/modules/feedback/presentation/safe-feedback-call';

/**
 * Marks `context` as delivered to the browser for the signed-in
 * Representative. Called once, from `FeedbackPrompt`'s mount effect — the
 * eligibility check that decided to render the prompt already ran
 * server-side before this component existed on the page, so this action's
 * only job is recording that the delivery actually reached the client.
 */
export async function recordFeedbackShownAction(context: FeedbackContext): Promise<RecordFeedbackShownResult> {
  return safeFeedbackCall(async () => {
    const gateway = await getFeedbackGateway();
    return gateway.recordShown(context);
  });
}

/**
 * Resolves `context` for the signed-in Representative — either an answer or
 * an explicit dismissal. `response`/`responseDetail` are only meaningful for
 * `outcome: 'answered'`; `FeedbackPrompt` always passes `null` for both on
 * `'dismissed'`.
 */
export async function resolveFeedbackAction(
  context: FeedbackContext,
  outcome: FeedbackOutcome,
  response: string | null,
  responseDetail: string | null,
): Promise<ResolveFeedbackResult> {
  return safeFeedbackCall(async () => {
    const gateway = await getFeedbackGateway();
    return gateway.resolve(context, outcome, response, responseDetail);
  });
}
