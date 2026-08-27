'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { ArrowLeft, Check, Copy, Instagram, MessageCircle, QrCode, Share2 } from 'lucide-react';

import type { OriginId } from '@/modules/analytics/domain/origin';
import { resolveDivulgacaoCopy } from '@/modules/marketing-materials/divulgacao-copy';
import { buildMarketingMaterialPropsForOrigin, type MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import { FORMAT_DIMENSIONS, getMaterialsForProduct, type MaterialFormat } from '@/modules/marketing-materials/registry';
import { MaterialPreview } from '@/modules/marketing-materials/presentation/material-preview';
import type { Representative, RepresentativeProduct } from '@/modules/representatives/domain/representative';
import { Button } from '@/shared/ui/button';
import { cardVariants } from '@/shared/ui/card';
import { Text } from '@/shared/ui/typography';
import { cn } from '@/shared/lib/cn';

/**
 * SET-84 D4 (docs/plans/SET-84_DIVULGACAO_LEAN_PLAN.md §2, D1/D4) — os 4
 * canais da UI. `format` decide qual dos 3 formatos existentes (SET-65:
 * post/story/poster) é mostrado; `origin` é o `OriginId` embutido no
 * link/QR desse material. WhatsApp/Status reaproveita o formato `story`
 * (mesma proporção 1080×1920 de um Status) — nenhum formato novo nasce
 * aqui, só reuso do que SET-65 já entrega.
 *
 * `link_qr` é o único canal que cobre dois `OriginId` (D1): o QR já embutido
 * no poster carrega `qrcode`, mas a ação própria "Copiar link" desse mesmo
 * card copia `direct` — ver `COPY_LINK_ORIGIN` abaixo.
 */
interface ChannelDef {
  readonly key: 'instagram_post' | 'instagram_story' | 'whatsapp' | 'link_qr';
  readonly label: string;
  readonly icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  readonly format: MaterialFormat;
  readonly origin: OriginId;
}

const CHANNELS: readonly ChannelDef[] = [
  { key: 'instagram_post', label: 'Instagram — Post', icon: Instagram, format: 'post', origin: 'instagram_post' },
  { key: 'instagram_story', label: 'Instagram — Story', icon: Instagram, format: 'story', origin: 'instagram_story' },
  { key: 'whatsapp', label: 'WhatsApp / Status', icon: MessageCircle, format: 'story', origin: 'whatsapp' },
  { key: 'link_qr', label: 'Link direto / QR Code', icon: QrCode, format: 'poster', origin: 'qrcode' },
];

/** D1: only `link_qr` copies a different origin than its own material/QR. */
const COPY_LINK_ORIGIN: Partial<Record<ChannelDef['key'], OriginId>> = {
  link_qr: 'direct',
};

const cardButtonClass = cn(
  cardVariants({ variant: 'outlined', padding: 'lg', interactive: true }),
  'flex w-full flex-col items-start gap-2 text-left',
);

type Step = 'product' | 'channel' | 'kit';

export function DivulgacaoFlow({
  representative,
  products,
}: {
  representative: Representative;
  products: readonly RepresentativeProduct[];
}) {
  const [step, setStep] = useState<Step>('product');
  const [selectedProduct, setSelectedProduct] = useState<RepresentativeProduct | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelDef | null>(null);

  if (step === 'channel' && selectedProduct) {
    return (
      <ChannelStep
        product={selectedProduct}
        onSelect={(channel) => {
          setSelectedChannel(channel);
          setStep('kit');
        }}
        onBack={() => setStep('product')}
      />
    );
  }

  if (step === 'kit' && selectedProduct && selectedChannel) {
    return (
      <KitStep
        key={`${selectedProduct.slug}-${selectedChannel.key}`}
        representative={representative}
        product={selectedProduct}
        channel={selectedChannel}
        onBack={() => setStep('channel')}
      />
    );
  }

  return (
    <ProductStep
      products={products}
      onSelect={(product) => {
        setSelectedProduct(product);
        setStep('channel');
      }}
    />
  );
}

function ProductStep({
  products,
  onSelect,
}: {
  products: readonly RepresentativeProduct[];
  onSelect: (product: RepresentativeProduct) => void;
}) {
  return (
    <div className="space-y-4">
      <Text as="h2" variant="title">O que você quer divulgar?</Text>
      <div className="grid gap-3 sm:grid-cols-2">
        {products.map((product) => (
          <button key={product.id} type="button" className={cardButtonClass} onClick={() => onSelect(product)}>
            <Text as="span" variant="body" className="font-medium">{product.name}</Text>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChannelStep({
  product,
  onSelect,
  onBack,
}: {
  product: RepresentativeProduct;
  onSelect: (channel: ChannelDef) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <BackButton label="Escolher outro produto" onClick={onBack} />
      <Text as="h2" variant="title">Como você quer divulgar {product.name}?</Text>
      <div className="grid gap-3 sm:grid-cols-2">
        {CHANNELS.map((channel) => (
          <button key={channel.key} type="button" className={cardButtonClass} onClick={() => onSelect(channel)}>
            <channel.icon aria-hidden className="h-5 w-5 text-brand" />
            <Text as="span" variant="body" className="font-medium">{channel.label}</Text>
          </button>
        ))}
      </div>
    </div>
  );
}

function KitStep({
  representative,
  product,
  channel,
  onBack,
}: {
  representative: Representative;
  product: RepresentativeProduct;
  channel: ChannelDef;
  onBack: () => void;
}) {
  const [materialProps, setMaterialProps] = useState<MarketingMaterialProps | null>(null);
  const [failed, setFailed] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMaterialProps(null);
    setFailed(false);
    buildMarketingMaterialPropsForOrigin(representative, product, channel.origin)
      .then((props) => {
        if (!cancelled) setMaterialProps(props);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [representative, product, channel]);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const slot = getMaterialsForProduct(product.slug).find((candidate) => candidate.format === channel.format);
  const copy = resolveDivulgacaoCopy(channel.origin, product.slug, {
    productName: product.name,
    link: materialProps?.publicUrl ?? '',
  });
  const copyLinkOrigin = COPY_LINK_ORIGIN[channel.key] ?? channel.origin;
  const shareLink = `${materialProps?.publicUrl?.split('?')[0] ?? ''}?src=${copyLinkOrigin}`;

  async function handleCopyText() {
    if (!copy) return;
    try {
      await navigator.clipboard.writeText(copy.text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Best-effort — the text stays visible on screen either way.
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Best-effort — the link stays visible on screen either way.
    }
  }

  async function handleShare() {
    if (!canShare) return;
    try {
      await navigator.share({ title: product.name, text: copy?.text, url: shareLink });
    } catch {
      // User cancelled the share sheet, or the browser rejected it — no error to surface.
    }
  }

  return (
    <div className="space-y-5">
      <BackButton label="Escolher outro canal" onClick={onBack} />
      <Text as="h2" variant="title">Seu material está pronto</Text>

      {failed ? (
        <Text as="p" variant="body" className="text-danger">
          Não foi possível montar o material agora. Tente novamente em instantes.
        </Text>
      ) : null}

      {materialProps && slot ? (
        <MaterialPreview
          Component={slot.Component}
          materialProps={materialProps}
          width={FORMAT_DIMENSIONS[channel.format].width}
          height={FORMAT_DIMENSIONS[channel.format].height}
          previewWidth={280}
          fileName={`${representative.slug}-${product.slug}-${channel.format}.png`}
        />
      ) : !failed ? (
        <Text as="p" variant="body">Gerando material…</Text>
      ) : null}

      {copy ? (
        <div className="space-y-2">
          <Text as="p" variant="body" className="whitespace-pre-wrap rounded-md border border-line bg-surface-sunken p-3">
            {copy.text}
          </Text>
          <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopyText()}>
            {copiedText ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
            {copiedText ? 'Texto copiado' : 'Copiar texto'}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopyLink()} disabled={!materialProps}>
          {copiedLink ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
          {copiedLink ? 'Link copiado' : 'Copiar link'}
        </Button>
        {canShare ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void handleShare()} disabled={!materialProps}>
            <Share2 aria-hidden className="h-4 w-4" />
            Compartilhar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      <ArrowLeft aria-hidden className="h-4 w-4" />
      {label}
    </Button>
  );
}
