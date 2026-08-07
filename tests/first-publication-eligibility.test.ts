import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  hasPublishedAtLeastOnce,
  isFirstPublicationFeedbackEligible,
} from '@/modules/feedback/domain/first-publication-eligibility';

describe('hasPublishedAtLeastOnce', () => {
  it('is false for an empty catalog', () => {
    assert.equal(hasPublishedAtLeastOnce([]), false);
  });

  it('is false when every entry is not_activated or draft — never published before', () => {
    assert.equal(hasPublishedAtLeastOnce([{ state: 'not_activated' }, { state: 'draft' }]), false);
  });

  it('is true when at least one entry is published', () => {
    assert.equal(hasPublishedAtLeastOnce([{ state: 'draft' }, { state: 'published' }]), true);
  });

  it('is true when an entry is unpublished — published_at is never cleared by unpublishing (ADR-043)', () => {
    assert.equal(hasPublishedAtLeastOnce([{ state: 'unpublished' }]), true);
  });
});

describe('isFirstPublicationFeedbackEligible (SET-61)', () => {
  it('is not eligible before any publication, regardless of the resolved flag', () => {
    assert.equal(isFirstPublicationFeedbackEligible([{ state: 'draft' }], false), false);
    assert.equal(isFirstPublicationFeedbackEligible([{ state: 'not_activated' }], false), false);
  });

  it('is eligible right after the first publication, while unresolved', () => {
    assert.equal(isFirstPublicationFeedbackEligible([{ state: 'published' }], false), true);
  });

  it('stays eligible for a since-unpublished first activation, while unresolved', () => {
    assert.equal(isFirstPublicationFeedbackEligible([{ state: 'unpublished' }], false), true);
  });

  it('is never eligible again once resolved (answered or dismissed), even with a published entry', () => {
    assert.equal(isFirstPublicationFeedbackEligible([{ state: 'published' }], true), false);
  });
});
