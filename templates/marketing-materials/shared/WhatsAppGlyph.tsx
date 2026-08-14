/**
 * Ícone de "conversa" usado apenas para sinalizar a chamada de WhatsApp nos
 * Posters (formato com prioridade alta para esse dado, conforme decisão de
 * produto). Deliberadamente um glifo genérico de balão de mensagem — não o
 * logo da marca WhatsApp — para não introduzir uma marca de terceiro na
 * peça. Cor herdada via `currentColor`, então cada identidade de produto
 * aplica seu próprio acento sem precisar de variantes do ícone.
 */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
