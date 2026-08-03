'use client';

import { useState } from 'react';

import {
  getActiveTab,
  type ProductContentTab,
} from '@/modules/representatives/domain/product-content/conexao-club';
import { Card } from '@/shared/ui/card';
import { cn } from '@/shared/lib/cn';
import { Text } from '@/shared/ui/typography';

/**
 * Tabs de conteúdo por categoria (CP3, `docs/COMMERCIAL_PAGE_CONTENT_PLAN.md`).
 * Grupo de botões que troca só o parágrafo de descrição visível — sem
 * navegação nova, sem CTA próprio: o único caminho até a conversão continua
 * sendo `WhatsappCta`/`LeadForm`, que este componente não toca (§3.1,
 * ADR-056). Zero chamada de rede, zero estado além de "qual aba está
 * selecionada".
 */
export function ProductContentTabs({ tabs }: { tabs: ProductContentTab[] }) {
  const [chaveSelecionada, setChaveSelecionada] = useState(tabs[0]?.chave ?? '');
  const abaAtiva = getActiveTab(tabs, chaveSelecionada);

  if (tabs.length === 0) return null;

  return (
    <Card variant="outlined" padding="lg">
      <div role="tablist" aria-label="Categorias de benefício" className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.chave}
            type="button"
            role="tab"
            aria-selected={tab.chave === chaveSelecionada}
            onClick={() => setChaveSelecionada(tab.chave)}
            className={cn(
              'rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-fast',
              tab.chave === chaveSelecionada
                ? 'border-brand bg-brand text-brand-contrast'
                : 'border-line bg-surface text-content-muted hover:border-line-strong hover:bg-surface-sunken',
            )}
          >
            {tab.rotulo}
          </button>
        ))}
      </div>
      <Text as="p" variant="body" className="mt-4 min-h-[3.2em]">
        {abaAtiva?.descricao ?? ''}
      </Text>
    </Card>
  );
}
