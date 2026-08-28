'use client';

import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';

import { generateQrCodeDataUrl } from '@/shared/lib/generate-qr-code-data-url';
import { Button } from '@/shared/ui/button';
import { FormAlert } from '@/shared/ui/form-alert';
import { Modal } from '@/shared/ui/modal';

/**
 * QrCodeDialog — SET-91, replaces the always-rendered `QrCodeCard`
 * (ADR-049) with an on-demand `Modal`. Same generation/download
 * infrastructure as before (`generateQrCodeDataUrl`, `toDataURL`'s `data:`
 * URI doubling as both `<img src>` and `<a download href>`) — only the
 * presentation changed, from a permanently-rendered card to a dialog opened
 * by "Gerar QR Code" (`PublishedPageActions`). Generation is deferred to
 * `open` so a representative who never opens the dialog never pays for it.
 */
export function QrCodeDialog({
  open,
  onOpenChange,
  url,
  fileName,
  productName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  fileName: string;
  productName: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDataUrl(null);
    setGenerationFailed(false);
    generateQrCodeDataUrl(url)
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null);
          setGenerationFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, attempt, open]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`QR Code — ${productName}`}
      description="Escaneie para acessar sua página."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" variant="primary" disabled={!dataUrl} asChild={Boolean(dataUrl)}>
            {dataUrl ? (
              <a href={dataUrl} download={fileName}>
                <Download aria-hidden="true" className="h-4 w-4" />
                Baixar QR Code
              </a>
            ) : (
              <>
                <Download aria-hidden="true" className="h-4 w-4" />
                Baixar QR Code
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3">
        {generationFailed ? (
          <div className="w-full space-y-3">
            <FormAlert
              tone="error"
              title="Não foi possível gerar o QR Code"
              description="Tente novamente ou use as outras opções de compartilhamento."
            />
            <Button type="button" size="sm" variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset.
          <img
            src={dataUrl}
            alt="QR Code da página pública"
            width={240}
            height={240}
            className="h-auto w-full max-w-[220px] rounded-md"
          />
        ) : (
          <div className="aspect-square w-full max-w-[220px] animate-pulse rounded-md bg-surface-sunken" aria-hidden="true" />
        )}
      </div>
    </Modal>
  );
}
