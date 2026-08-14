import type { ReactNode } from 'react';

interface ScaledFrameProps {
  width: number;
  height: number;
  targetWidth: number;
  children: ReactNode;
}

/**
 * Utilitário de escala para a galeria de preview: renderiza a peça no
 * tamanho real (para que a tipografia/QR fiquem fiéis) dentro de um viewport
 * menor, via CSS transform. Não é um componente de marketing — é infraestrutura
 * de desenvolvimento reutilizável entre as 21 peças.
 */
export function ScaledFrame({ width, height, targetWidth, children }: ScaledFrameProps) {
  const scale = targetWidth / width;
  const targetHeight = height * scale;

  return (
    <div style={{ width: targetWidth, height: targetHeight, overflow: 'hidden', position: 'relative' }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}
