import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getActivationViewState } from '@/modules/representatives/presentation/activation-view-state';

describe('getActivationViewState', () => {
  it('shows Published and exposes the public link only with an active Subscription', () => {
    assert.deepEqual(getActivationViewState('published', true), {
      badge: { label: 'Publicado', variant: 'success' },
      canPublish: false,
      isPubliclyAvailable: true,
      subscriptionBlocked: false,
    });
  });

  it('never shows Published or exposes the public link when Subscription is inactive', () => {
    assert.deepEqual(getActivationViewState('published', false), {
      badge: { label: 'Indisponível — assinatura inativa', variant: 'warning' },
      canPublish: false,
      isPubliclyAvailable: false,
      subscriptionBlocked: true,
    });
  });

  it('blocks publication from draft and unpublished without an active Subscription', () => {
    for (const state of ['draft', 'unpublished'] as const) {
      const view = getActivationViewState(state, false);
      assert.equal(view.canPublish, false);
      assert.equal(view.subscriptionBlocked, true);
      assert.equal(view.isPubliclyAvailable, false);
    }
  });

  it('still permits activation into draft without a Subscription', () => {
    assert.deepEqual(getActivationViewState('not_activated', false), {
      badge: { label: 'Não ativado', variant: 'neutral' },
      canPublish: false,
      isPubliclyAvailable: false,
      subscriptionBlocked: false,
    });
  });
});
