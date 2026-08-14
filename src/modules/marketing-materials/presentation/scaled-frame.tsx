'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Renders a piece at its real pixel size (so typography/QR stay faithful to
 * what gets exported) inside a smaller on-screen viewport via a CSS
 * transform. Preview-only infrastructure — never changes what
 * `MaterialPreview`'s export button captures, which always reads the
 * unscaled node directly (plan §26: "não confunda tamanho do preview com
 * tamanho da exportação").
 *
 * `targetWidth` is a ceiling, not a fixed size: on narrow phones the card's
 * real content width (after page + card padding) can fall below it — a
 * hardcoded `targetWidth` overflowed the screen there. A `ResizeObserver` on
 * the full-width measuring wrapper below finds the actual available width so
 * the scale never renders wider than what's really on screen.
 */
export function ScaledFrame({
  width,
  height,
  targetWidth,
  children,
}: {
  width: number;
  height: number;
  targetWidth: number;
  children: ReactNode;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(targetWidth);

  useEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    const update = () => setAvailableWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const effectiveWidth = Math.min(targetWidth, availableWidth || targetWidth);
  const scale = effectiveWidth / width;
  const targetHeight = height * scale;

  return (
    <div ref={measureRef} className="mx-auto" style={{ width: '100%', maxWidth: targetWidth }}>
      <div
        className="overflow-hidden rounded-lg border border-line"
        style={{ width: effectiveWidth, height: targetHeight, position: 'relative' }}
      >
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  );
}
