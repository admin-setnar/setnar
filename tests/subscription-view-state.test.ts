import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getSubscriptionPanelState,
  getSubscriptionViewState,
  type SubscriptionViewState,
} from '@/modules/billing/presentation/subscription-view-state';
import type { OwnSubscriptionView } from '@/modules/billing/domain/subscription-repository';

function view(overrides: Partial<OwnSubscriptionView>): OwnSubscriptionView {
  return {
    status: 'suspended',
    amountCents: 2790,
    currency: 'BRL',
    currentPeriodEnd: null,
    hasExternalSubscription: false,
    ...overrides,
  };
}

describe('getSubscriptionViewState', () => {
  it('maps no row to "none" — nunca iniciou checkout', () => {
    assert.deepEqual(getSubscriptionViewState(null), { kind: 'none' });
  });

  it('maps status "active" to "active"', () => {
    assert.deepEqual(getSubscriptionViewState(view({ status: 'active' })), { kind: 'active' });
  });

  it('maps "canceled" with current_period_end no futuro a "active_until"', () => {
    const currentPeriodEnd = new Date(Date.now() + 86_400_000).toISOString();
    assert.deepEqual(getSubscriptionViewState(view({ status: 'canceled', currentPeriodEnd })), {
      kind: 'active_until',
      currentPeriodEnd,
    });
  });

  it('maps "canceled" com current_period_end no passado a "inactive"', () => {
    const currentPeriodEnd = new Date(Date.now() - 86_400_000).toISOString();
    assert.deepEqual(getSubscriptionViewState(view({ status: 'canceled', currentPeriodEnd })), { kind: 'inactive' });
  });

  it('maps "canceled" sem current_period_end a "inactive" — nenhuma graça sem data', () => {
    assert.deepEqual(getSubscriptionViewState(view({ status: 'canceled', currentPeriodEnd: null })), {
      kind: 'inactive',
    });
  });

  it('maps "suspended" sem external subscription a "checkout_incomplete" — 1º pagamento nunca confirmado', () => {
    assert.deepEqual(
      getSubscriptionViewState(view({ status: 'suspended', hasExternalSubscription: false })),
      { kind: 'checkout_incomplete' },
    );
  });

  it('maps "suspended" com external subscription a "payment_failed" — só alcançável após um pagamento aprovado', () => {
    assert.deepEqual(
      getSubscriptionViewState(view({ status: 'suspended', hasExternalSubscription: true })),
      { kind: 'payment_failed' },
    );
  });

  it('maps "past_due" com external subscription a "payment_failed" — mesmo ramo de "suspended"', () => {
    assert.deepEqual(
      getSubscriptionViewState(view({ status: 'past_due', hasExternalSubscription: true })),
      { kind: 'payment_failed' },
    );
  });

  it('SET-67: maps "trialing" com current_period_end no futuro a "trialing"', () => {
    const currentPeriodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();
    assert.deepEqual(getSubscriptionViewState(view({ status: 'trialing', currentPeriodEnd })), {
      kind: 'trialing',
      trialEndsAt: currentPeriodEnd,
    });
  });

  it('SET-67: maps "trialing" com current_period_end no passado a "trial_expired" — a linha nunca muda de status sozinha', () => {
    const currentPeriodEnd = new Date(Date.now() - 86_400_000).toISOString();
    assert.deepEqual(getSubscriptionViewState(view({ status: 'trialing', currentPeriodEnd })), {
      kind: 'trial_expired',
    });
  });

  it('SET-67: maps "trialing" sem current_period_end a "trial_expired" — nenhum trial sem data', () => {
    assert.deepEqual(getSubscriptionViewState(view({ status: 'trialing', currentPeriodEnd: null })), {
      kind: 'trial_expired',
    });
  });
});

describe('getSubscriptionPanelState', () => {
  const ALL_KINDS: readonly SubscriptionViewState[] = [
    { kind: 'none' },
    { kind: 'checkout_incomplete' },
    { kind: 'payment_failed' },
    { kind: 'active' },
    { kind: 'active_until', currentPeriodEnd: new Date(Date.now() + 86_400_000).toISOString() },
    { kind: 'inactive' },
    { kind: 'trialing', trialEndsAt: new Date(Date.now() + 30 * 86_400_000).toISOString() },
    { kind: 'trial_expired' },
  ];

  it('shows only the checkout form, no banner, for "none" and "checkout_incomplete"', () => {
    for (const state of [{ kind: 'none' }, { kind: 'checkout_incomplete' }] as const) {
      assert.deepEqual(getSubscriptionPanelState(state, undefined), {
        banner: null,
        showCheckoutForm: true,
        canCancel: false,
      });
    }
  });

  it('shows an error banner and the checkout form for "payment_failed"', () => {
    const result = getSubscriptionPanelState({ kind: 'payment_failed' }, undefined);
    assert.equal(result.showCheckoutForm, true);
    assert.equal(result.banner?.tone, 'error');
  });

  it('shows an error banner and the checkout form for "inactive"', () => {
    const result = getSubscriptionPanelState({ kind: 'inactive' }, undefined);
    assert.equal(result.showCheckoutForm, true);
    assert.equal(result.banner?.tone, 'error');
  });

  it('shows a success banner and no form for "active"', () => {
    assert.deepEqual(getSubscriptionPanelState({ kind: 'active' }, undefined), {
      banner: { tone: 'success', title: 'Sua assinatura está ativa.' },
      showCheckoutForm: false,
      canCancel: true,
    });
  });

  it('shows a success banner with the grace date and no form for "active_until"', () => {
    const currentPeriodEnd = new Date(Date.now() + 86_400_000).toISOString();
    const result = getSubscriptionPanelState({ kind: 'active_until', currentPeriodEnd }, undefined);
    assert.equal(result.showCheckoutForm, false);
    assert.equal(result.banner?.tone, 'success');
    assert.ok(result.banner!.description!.includes(new Date(currentPeriodEnd).toLocaleDateString('pt-BR')));
  });

  it('SET-67: shows a success banner with the trial end date, and still shows the checkout form (early conversion), for "trialing"', () => {
    const trialEndsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const result = getSubscriptionPanelState({ kind: 'trialing', trialEndsAt }, undefined);
    assert.equal(result.showCheckoutForm, true);
    assert.equal(result.banner?.tone, 'success');
    assert.ok(result.banner!.description!.includes(new Date(trialEndsAt).toLocaleDateString('pt-BR')));
  });

  it('SET-67: shows an error banner and the checkout form for "trial_expired"', () => {
    const result = getSubscriptionPanelState({ kind: 'trial_expired' }, undefined);
    assert.equal(result.showCheckoutForm, true);
    assert.equal(result.banner?.tone, 'error');
  });

  it('overrides every non-active, non-trialing kind with the "aguardando confirmação" banner and hides the form on ?checkout=success', () => {
    for (const state of ALL_KINDS) {
      if (state.kind === 'active' || state.kind === 'active_until' || state.kind === 'trialing') continue;
      const result = getSubscriptionPanelState(state, 'success');
      assert.equal(result.showCheckoutForm, false, `kind=${state.kind}`);
      assert.equal(result.banner?.title, 'Aguardando confirmação de pagamento', `kind=${state.kind}`);
    }
  });

  it('SET-67: ?checkout=success never overrides "trialing" — it is already confirmedActive', () => {
    const trialEndsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const result = getSubscriptionPanelState({ kind: 'trialing', trialEndsAt }, 'success');
    assert.equal(result.banner?.title, 'Seu período de teste está ativo.');
    assert.equal(result.showCheckoutForm, true);
  });

  it('SET-32: only allows canceling from "active" and "payment_failed" — never from an already-canceled or never-started state', () => {
    const expected: Record<SubscriptionViewState['kind'], boolean> = {
      none: false,
      checkout_incomplete: false,
      payment_failed: true,
      active: true,
      active_until: false,
      inactive: false,
      trialing: false,
      trial_expired: false,
    };
    for (const state of ALL_KINDS) {
      const result = getSubscriptionPanelState(state, undefined);
      assert.equal(result.canCancel, expected[state.kind], `kind=${state.kind}`);
    }
  });

  it('SET-32: ?checkout=success never grants canceling for a kind the persisted state does not already allow', () => {
    // `active`/`active_until` are `confirmedActive` — the redirect param
    // never overrides them, so `canCancel` passes through unchanged
    // (true/false respectively, same as without the param). Every other
    // kind gets forced into the "aguardando confirmação" branch, which
    // never allows canceling.
    const expected: Record<SubscriptionViewState['kind'], boolean> = {
      none: false,
      checkout_incomplete: false,
      payment_failed: false,
      active: true,
      active_until: false,
      inactive: false,
      // `trialing` é `confirmedActive`, então o override nem entra em jogo —
      // `canCancel` passa direto (`false`, mesma coisa sem o param).
      trialing: false,
      trial_expired: false,
    };
    for (const state of ALL_KINDS) {
      const result = getSubscriptionPanelState(state, 'success');
      assert.equal(result.canCancel, expected[state.kind], `kind=${state.kind}`);
    }
  });

  it('never lets ?checkout=success override an already-active subscription', () => {
    const active = getSubscriptionPanelState({ kind: 'active' }, 'success');
    assert.equal(active.banner?.title, 'Sua assinatura está ativa.');

    const currentPeriodEnd = new Date(Date.now() + 86_400_000).toISOString();
    const activeUntil = getSubscriptionPanelState({ kind: 'active_until', currentPeriodEnd }, 'success');
    assert.equal(activeUntil.banner?.title, 'Assinatura cancelada');
  });
});
