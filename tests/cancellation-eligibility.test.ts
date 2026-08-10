import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isCancellationFeedbackEligible } from '@/modules/feedback/domain/cancellation-eligibility';

describe('isCancellationFeedbackEligible (SET-63)', () => {
  it('is not eligible without an active grace-period cancellation', () => {
    assert.equal(isCancellationFeedbackEligible(false, false), false);
  });

  it('is not eligible when already resolved for the current event, even with an active grace-period cancellation', () => {
    assert.equal(isCancellationFeedbackEligible(true, true), false);
  });

  it('is eligible with an active grace-period cancellation that is not yet resolved', () => {
    assert.equal(isCancellationFeedbackEligible(true, false), true);
  });

  it('is never eligible without a grace-period cancellation, regardless of resolution state', () => {
    assert.equal(isCancellationFeedbackEligible(false, true), false);
  });

  it('flips back to eligible for a new cancellation event — "alreadyResolved" always describes only the latest event, by contract with confirm_own_subscription_cancellation', () => {
    // First event: shown, answered — not eligible anymore for that event.
    assert.equal(isCancellationFeedbackEligible(true, true), false);
    // A later, independent cancellation event resets `alreadyResolved` to
    // false at the source (a fresh row) — this function has no memory of
    // the prior event and simply reflects whatever the caller read.
    assert.equal(isCancellationFeedbackEligible(true, false), true);
  });
});
