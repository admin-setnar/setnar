'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

/**
 * `/app/layout.tsx`'s thin trial reminder — renders on every authenticated
 * route while `getSubscriptionViewState()` reports `kind: 'trialing'`, so a
 * representative never has to open `/app/conta` just to find out when the
 * free trial ends. Dismiss is local `useState`, same as `FeedbackPrompt`:
 * reappears on the next navigation/reload rather than persisting, since
 * there is no server-side "seen" state to track here — just the current
 * `trialEndsAt`, which the layout already recomputes every request.
 */
export function TrialBanner({ trialEndsAt }: { trialEndsAt: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const formattedDate = new Date(trialEndsAt).toLocaleDateString('pt-BR');

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 border-b border-line bg-brand-subtle px-4 py-2 text-center text-sm text-content"
    >
      <p>
        Seu período de teste grátis vai até <span className="font-medium">{formattedDate}</span>.{' '}
        <Link href="/app/conta#assinatura" className="font-medium underline underline-offset-4">
          Assine agora
        </Link>
      </p>
      <button
        type="button"
        aria-label="Dispensar aviso de período de teste"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-sm p-1 text-content-subtle transition-colors duration-fast hover:bg-surface-sunken hover:text-content"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
