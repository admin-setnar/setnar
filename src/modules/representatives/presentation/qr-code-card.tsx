'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { toDataURL } from 'qrcode';

import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
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

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    toDataURL(url, { width: 240, margin: 1 })
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card variant="outlined" padding="md" className="flex flex-col items-center gap-3 text-center">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote asset.
        <img src={dataUrl} alt="QR Code da página pública" width={120} height={120} className="rounded-md" />
      ) : (
        <div className="h-[120px] w-[120px] animate-pulse rounded-md bg-surface-sunken" aria-hidden="true" />
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

        <Button size="sm" variant="secondary" fullWidth onClick={() => void handleCopy()}>
          {copied ? (
            <Check aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Copy aria-hidden="true" className="h-4 w-4" />
          )}
          {copied ? 'Copiado!' : 'Copiar link'}
        </Button>
      </div>

      <Text as="p" variant="caption" className="break-all">
        {url}
      </Text>
    </Card>
  );
}
