'use client';

import { useRef, useState, type ComponentType } from 'react';
import { toPng } from 'html-to-image';
import { AlertTriangle, Download } from 'lucide-react';

import type { MarketingMaterialProps } from '@/modules/marketing-materials/material-props';
import { ScaledFrame } from '@/modules/marketing-materials/presentation/scaled-frame';
import { Button } from '@/shared/ui/button';
import { Text } from '@/shared/ui/typography';

/**
 * D1 (`MARKETING_MATERIALS_PLAN.md`): client-side DOM capture via
 * `html-to-image`, chosen over server-side rendering after a POC against
 * these same three Conexão Green pieces confirmed pixel-perfect dimensions
 * and full visual fidelity (gradients, box-shadow, pseudo-elements, custom
 * fonts) with zero new server infrastructure. See the ADR for the full
 * evidence table.
 *
 * The captured node is a second, off-screen copy of the piece at its real
 * pixel size — not the on-screen `ScaledFrame` copy. `transform: scale()`
 * only changes what's visually painted, not layout dimensions, but nothing
 * in the POC exercised a capture through a scaled ancestor, so this keeps
 * capture and preview on two independent nodes rather than relying on that
 * being safe.
 */
export function MaterialPreview({
  Component,
  materialProps,
  width,
  height,
  previewWidth,
  fileName,
}: {
  Component: ComponentType<MarketingMaterialProps>;
  materialProps: MarketingMaterialProps;
  width: number;
  height: number;
  previewWidth: number;
  fileName: string;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  async function handleDownload() {
    if (exporting || !captureRef.current) return;
    setExporting(true);
    setExportFailed(false);
    setStatusMessage('Gerando arquivo…');
    try {
      await document.fonts.ready;
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 1,
        cacheBust: true,
        width,
        height,
        canvasWidth: width,
        canvasHeight: height,
      });
      // Blob + object URL, not the raw data: URI directly on the anchor —
      // more reliable triggering a real download (vs. opening in a new tab)
      // across mobile browsers.
      const blob = await (await fetch(dataUrl)).blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setStatusMessage('Download iniciado.');
    } catch {
      setExportFailed(true);
      setStatusMessage('Falha ao gerar o arquivo.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        aria-hidden="true"
        style={{ position: 'absolute', top: -99999, left: -99999, pointerEvents: 'none' }}
      >
        <div ref={captureRef}>
          <Component {...materialProps} />
        </div>
      </div>

      <div className="mx-auto w-fit overflow-hidden rounded-lg border border-line">
        <ScaledFrame width={width} height={height} targetWidth={previewWidth}>
          <Component {...materialProps} />
        </ScaledFrame>
      </div>

      {exportFailed ? (
        <div className="flex items-start gap-2 text-sm text-danger">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <Text as="span" variant="caption">Não foi possível gerar o arquivo. Tente novamente.</Text>
        </div>
      ) : null}

      <Button type="button" variant="primary" size="md" fullWidth loading={exporting} onClick={() => void handleDownload()}>
        {exporting ? null : <Download aria-hidden="true" className="h-4 w-4" />}
        {exporting ? 'Gerando…' : 'Baixar PNG'}
      </Button>

      <span className="sr-only" aria-live="polite">{statusMessage}</span>
    </div>
  );
}
