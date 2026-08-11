import { ArrowUpRight, MessageCircle } from 'lucide-react';

import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/badge';
import { BrandRule } from '@/shared/ui/brand-rule';
import { LogoSymbol } from '@/shared/brand/logo';

/**
 * ProductPreview
 *
 * Purpose: show what the product actually produces — a published commercial
 * page with its QR code and its aggregate visit/click/lead counters (SET-37)
 * — instead of a decorative illustration. Built entirely from markup and
 * tokens: no image assets, no layout shift, nothing to download.
 * Two product rows, not one: a representative activates one Commercial Page
 * per Product (D5.1), each with its own QR Code and its own counters — a
 * single row would misrepresent that as one page for the whole account.
 * Accessibility: the whole preview is decorative and hidden from assistive
 * technology, with one sentence of real text describing it for screen readers.
 * Content note: figures are illustrative placeholders. Nothing here states or
 * implies earnings or results. Product names shown (Conexão Green, Conexão
 * Solar) are real catalog products (`representatives/domain/product-content`),
 * not fabricated. Shows the three counters `/app/paginas` actually renders
 * per Product (visits, WhatsApp clicks, leads) — it does NOT depict a
 * per-lead list with name/origin: no such view exists for the representative
 * (`docs/PRODUCT.md`: Lead Management remains "future vision — no interface
 * to work them").
 */
export function ProductPreview({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <p className="sr-only">
        Prévia da interface: duas páginas comerciais publicadas, cada uma com
        seu QR Code e seus próprios contadores de visitas, cliques e leads.
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
                <p className="text-[13px] font-semibold text-content">Minhas páginas</p>
                <p className="text-[11px] text-content-subtle">setnar.com/joao-silva</p>
              </div>
              <Badge variant="success">Publicadas</Badge>
            </div>

            <div className="space-y-3">
              <ProductRow name="Conexão Green" seed={0} visits="128" clicks="34" leads="9" />
              <ProductRow name="Conexão Solar" seed={1} visits="76" clicks="21" leads="4" />
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
 * One product's Commercial Page row: its own QR Code and its own counters —
 * never shared across products (D5.1, one Commercial Page per Product).
 */
function ProductRow({
  name,
  seed,
  visits,
  clicks,
  leads,
}: {
  name: string;
  seed: number;
  visits: string;
  clicks: string;
  leads: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-content-subtle">
        {name}
      </p>
      <div className="flex gap-3 rounded-lg border border-line p-3">
        <QrPlaceholder seed={seed} />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine className="w-3/4" />
          <SkeletonLine className="w-1/2 opacity-70" />
          <div className="flex gap-2 pt-1">
            <MetricChip label="Visitas" value={visits} />
            <MetricChip label="Cliques" value={clicks} />
            <MetricChip label="Leads" value={leads} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A deterministic QR-like pattern. Deliberately not random: a random fill would
 * differ between server and client render and break hydration. `seed` only
 * varies the noise between the three finder corners (still deterministic —
 * same input, same output on server and client) so two rows don't render the
 * exact same pattern twice.
 */
function QrPlaceholder({ seed = 0 }: { seed?: number }) {
  const cells = Array.from({ length: 121 }, (_, index) => {
    const x = index % 11;
    const y = Math.floor(index / 11);
    const isFinder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    return isFinder || (x * 7 + y * 13 + seed * 5) % 3 === 0;
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

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-sm bg-surface-sunken px-2 py-1 text-[11px] text-content-muted">
      <span className="font-semibold text-content">{value}</span> {label}
    </span>
  );
}
