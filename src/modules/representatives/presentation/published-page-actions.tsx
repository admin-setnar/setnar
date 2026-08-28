'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, QrCode } from 'lucide-react';

import { QrCodeDialog } from '@/modules/representatives/presentation/qr-code-dialog';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';

/**
 * PublishedPageActions — SET-91, the three sharing actions for a `published`
 * (and publicly available) Product Activation: "Copiar link", "Abrir site",
 * "Gerar QR Code". Replaces the old always-visible QR card + duplicated URL
 * block in `RepresentativeHub`/`ProductActivationCard` — `url` is the same
 * `buildCommercialPageUrl()` string those callers already computed, the
 * bare canonical link every derived URL below is built from.
 *
 * SET-105 (AUDIT_SET-101 §8) — "Copiar link" and "Gerar QR Code" are known
 * distribution mechanisms, so each tags `url` with its own `?src=` before
 * using it (`direct`/`qrcode`, same allowlist Divulgação already writes to).
 * "Abrir site" keeps the bare `url`: it is the representative inspecting
 * their own live page, not a distribution action — `isViewerOwner`
 * (`a8ab2de`) already excludes that click from analytics regardless.
 *
 * Stacks to one action per row on narrow viewports, sits side by side from
 * `sm` up — same `fullWidth` + `sm:w-auto` pattern `LeadInbox`'s WhatsApp
 * button already uses for the same mobile-first reason.
 */
export function PublishedPageActions({
  url,
  fileName,
  productName,
}: {
  url: string;
  fileName: string;
  productName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const copyLinkUrl = `${url}?src=direct`;
  const qrCodeUrl = `${url}?src=qrcode`;

  async function handleCopy() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(copyLinkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          fullWidth
          className="sm:w-auto"
          onClick={() => void handleCopy()}
        >
          {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
          {copied ? 'Link copiado' : 'Copiar link'}
        </Button>

        <Button asChild variant="secondary" size="sm" fullWidth className="sm:w-auto">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            Abrir site
          </a>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          fullWidth
          className="sm:w-auto"
          onClick={() => setQrOpen(true)}
        >
          <QrCode aria-hidden="true" className="h-4 w-4" />
          Gerar QR Code
        </Button>
      </div>

      {copyFailed ? (
        <FormAlert
          tone="error"
          title="Não foi possível copiar automaticamente"
          description={`Copie manualmente: ${copyLinkUrl}`}
        />
      ) : null}

      <span className="sr-only" aria-live="polite">{copied ? 'Link copiado.' : ''}</span>

      <QrCodeDialog open={qrOpen} onOpenChange={setQrOpen} url={qrCodeUrl} fileName={fileName} productName={productName} />
    </div>
  );
}
