import type { ReactNode } from 'react';

/**
 * Renders a piece at its real pixel size (so typography/QR stay faithful to
 * what gets exported) inside a smaller on-screen viewport via a CSS
 * transform. Preview-only infrastructure — never changes what
 * `MaterialPreview`'s export button captures, which always reads the
 * unscaled node directly (plan §26: "não confunda tamanho do preview com
 * tamanho da exportação").
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
  const scale = targetWidth / width;
  const targetHeight = height * scale;

  return (
    <div style={{ width: targetWidth, height: targetHeight, overflow: 'hidden', position: 'relative' }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  );
}
