import { ArrowUpRight, MessageCircle } from 'lucide-react';

import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/badge';
import { BrandRule } from '@/shared/ui/brand-rule';
import { LogoSymbol } from '@/shared/brand/logo';

/**
 * ProductPreview
 *
 * Purpose: show what the product actually produces — a published commercial
 * page with its QR code — instead of a decorative illustration. Built
 * entirely from markup and tokens: no image assets, no layout shift, nothing
 * to download.
 * Accessibility: the whole preview is decorative and hidden from assistive
 * technology, with one sentence of real text describing it for screen readers.
 * Content note: figures are illustrative placeholders. Nothing here states or
 * implies earnings or results. Deliberately does NOT depict a leads
 * list or visit/click counters — no such view exists for the representative
 * yet (SET-37); showing one here would be the exact overpromise SET-39
 * removed from the surrounding copy.
 */
export function ProductPreview({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <p className="sr-only">
        Prévia da interface: uma página comercial publicada, com QR Code.
      </p>

      <div
        aria-hidden="true"
        className="relative overflow-hidden rounded-xl border border-line bg-surface-raised shadow-raised"
      >
        <WindowChrome />

        <div className="flex">
          <MiniSidebar />

          <div className="min-w-0 flex-1 space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[13px] font-semibold text-content">Minha página</p>
                <p className="text-[11px] text-content-subtle">setnar.com/joao-silva</p>
              </div>
              <Badge variant="success">Publicada</Badge>
            </div>

            <div className="flex gap-3 rounded-lg border border-line p-3">
              <QrPlaceholder />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonLine className="w-3/4" />
                <SkeletonLine className="w-1/2 opacity-70" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating notification: the product's real, working contact path —
          a click straight into the representative's own WhatsApp, not a
          dashboard/inbox that doesn't exist yet. */}
      <div
        aria-hidden="true"
        className="absolute -bottom-5 -left-4 hidden items-center gap-3 rounded-lg border border-line bg-surface-raised px-4 py-3 shadow-overlay sm:flex"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-success-subtle text-success">
          <MessageCircle size={16} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[13px] font-semibold leading-tight text-content">Novo contato</p>
          <p className="text-[11px] leading-tight text-content-subtle">
            chamou você no WhatsApp agora
          </p>
        </div>
      </div>
    </div>
  );
}

function WindowChrome() {
  return (
    <div className="flex items-center gap-3 border-b border-line bg-surface-sunken px-4 py-3">
      <span className="flex gap-1.5">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        ))}
      </span>
      <span className="flex flex-1 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] text-content-subtle">
        setnar.com
        <ArrowUpRight size={11} className="ml-auto" />
      </span>
    </div>
  );
}

function MiniSidebar() {
  return (
    <div className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-line bg-surface-sunken py-5 sm:flex">
      <LogoSymbol className="h-3 w-auto text-content" />
      <BrandRule className="scale-[0.42] opacity-70" />
      <div className="mt-1 flex flex-col gap-2">
        {[0, 1, 2, 3].map((item) => (
          <span
            key={item}
            className={cn('h-6 w-6 rounded-md', item === 0 ? 'bg-brand/10' : 'bg-line/60')}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A deterministic QR-like pattern. Deliberately not random: a random fill would
 * differ between server and client render and break hydration.
 */
function QrPlaceholder() {
  const cells = Array.from({ length: 121 }, (_, index) => {
    const x = index % 11;
    const y = Math.floor(index / 11);
    const isFinder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    return isFinder || (x * 7 + y * 13) % 3 === 0;
  });

  return (
    <div className="grid h-[70px] w-[70px] shrink-0 grid-cols-11 gap-px rounded-md border border-line bg-surface p-1.5">
      {cells.map((filled, index) => (
        <span
          key={index}
          className={cn('aspect-square rounded-[1px]', filled ? 'bg-content' : 'bg-transparent')}
        />
      ))}
    </div>
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return <span className={cn('block h-2 rounded-full bg-line', className)} />;
}
