import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isValuePerceptionFeedbackEligible,
  VALUE_PERCEPTION_ELIGIBILITY_DAYS,
} from '@/modules/feedback/domain/value-perception-eligibility';

const NOW = new Date('2026-08-07T12:00:00.000Z');

function daysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('isValuePerceptionFeedbackEligible (SET-62)', () => {
  it('is not eligible when never published', () => {
    assert.equal(
      isValuePerceptionFeedbackEligible({ firstPublishedAt: null, hasVisitEvent: true }, false, NOW),
      false,
    );
  });

  it('is not eligible when published 14+ days ago but no visit was ever recorded — structural, not a deferral', () => {
    const longAgo = daysBefore(NOW, VALUE_PERCEPTION_ELIGIBILITY_DAYS + 100);
    assert.equal(
      isValuePerceptionFeedbackEligible({ firstPublishedAt: longAgo, hasVisitEvent: false }, false, NOW),
      false,
    );
  });

  it('is not eligible before the 14-day threshold, even with a visit', () => {
    const recently = daysBefore(NOW, VALUE_PERCEPTION_ELIGIBILITY_DAYS - 1);
    assert.equal(
      isValuePerceptionFeedbackEligible({ firstPublishedAt: recently, hasVisitEvent: true }, false, NOW),
      false,
    );
  });

  it('is eligible exactly at the 14-day boundary, with a visit and unresolved', () => {
    const exactlyAtThreshold = daysBefore(NOW, VALUE_PERCEPTION_ELIGIBILITY_DAYS);
    assert.equal(
      isValuePerceptionFeedbackEligible({ firstPublishedAt: exactlyAtThreshold, hasVisitEvent: true }, false, NOW),
      true,
    );
  });

  it('is eligible well past the threshold, with a visit and unresolved', () => {
    const longAgo = daysBefore(NOW, VALUE_PERCEPTION_ELIGIBILITY_DAYS + 30);
    assert.equal(
      isValuePerceptionFeedbackEligible({ firstPublishedAt: longAgo, hasVisitEvent: true }, false, NOW),
      true,
    );
  });

  it('is never eligible again once resolved (answered or dismissed), regardless of the other signals', () => {
    const longAgo = daysBefore(NOW, VALUE_PERCEPTION_ELIGIBILITY_DAYS + 30);
    assert.equal(
      isValuePerceptionFeedbackEligible({ firstPublishedAt: longAgo, hasVisitEvent: true }, true, NOW),
      false,
    );
  });
});
