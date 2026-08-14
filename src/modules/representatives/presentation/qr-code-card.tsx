'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, RefreshCw } from 'lucide-react';

import { generateQrCodeDataUrl } from '@/shared/lib/generate-qr-code-data-url';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormAlert } from '@/shared/ui/form-alert';
import { Input } from '@/shared/ui/input';
import { Text } from '@/shared/ui/typography';

/**
 * QrCodeCard — QR1 (`docs/QR_ANALYTICS_PLAN.md`, §3.1, decided client-side).
 *
 * The QR encodes `url` as-is — no server round-trip, no persisted "generation"
 * event, no new migration. `url` is the same public link `RepresentativeHub`
 * already computes from `SITE_URL` + slug + product slug; this component
 * never resolves a hostname of its own.
 *
 * `toDataURL` (not `toCanvas`) is deliberate: a data: URI doubles as both the
 * `<img>` source and the download `href` (an anchor's `download` attribute
 * accepts a data: URI directly), so there is no canvas element, no ref, and
 * no `toBlob` step to manage.
 */
export function QrCodeCard({ url, fileName }: { url: string; fileName: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
  }, [url, attempt]);

  async function handleCopy() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    }
  }

  return (
    <Card variant="outlined" padding="md" className="flex flex-col items-center gap-3 text-center">
      {generationFailed ? (
        <div className="w-full space-y-3">
          <FormAlert
            tone="error"
            title="Não foi possível gerar o QR Code"
            description="Tente novamente ou compartilhe o link abaixo."
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
          className="h-auto w-full max-w-[160px] rounded-md"
        />
      ) : (
        <div className="aspect-square w-full max-w-[160px] animate-pulse rounded-md bg-surface-sunken" aria-hidden="true" />
      )}

      <div className="flex w-full gap-2">
        <Button
          size="sm"
          variant="secondary"
          fullWidth
          disabled={!dataUrl}
          asChild={Boolean(dataUrl)}
        >
          {dataUrl ? (
            <a href={dataUrl} download={fileName}>
              <Download aria-hidden="true" className="h-4 w-4" />
              Baixar
            </a>
          ) : (
            <>
              <Download aria-hidden="true" className="h-4 w-4" />
              Baixar
            </>
          )}
        </Button>

        <Button type="button" size="sm" variant="secondary" fullWidth onClick={() => void handleCopy()}>
          {copied ? (
            <Check aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Copy aria-hidden="true" className="h-4 w-4" />
          )}
          {copied ? 'Copiado!' : 'Copiar link'}
        </Button>
      </div>

      <div className="w-full space-y-2 text-left">
        <label htmlFor={`public-link-${fileName}`} className="text-sm font-medium text-content">
          Link público
        </label>
        <Input
          ref={linkInputRef}
          id={`public-link-${fileName}`}
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          aria-describedby={copyFailed ? `copy-help-${fileName}` : undefined}
        />
        <Text id={`copy-help-${fileName}`} as="p" variant="caption" className={copyFailed ? '' : 'sr-only'}>
          {copyFailed ? 'A cópia automática não está disponível. O link foi selecionado para você copiar manualmente.' : 'Selecione o campo para copiar o link manualmente.'}
        </Text>
      </div>

      <span className="sr-only" aria-live="polite">{copied ? 'Link copiado.' : ''}</span>
    </Card>
  );
}
