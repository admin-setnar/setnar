/**
 * Ícone de "conversa" usado para sinalizar a chamada de WhatsApp nas peças de
 * marketing. Deliberadamente um glifo genérico de balão de mensagem — não o
 * logo da marca WhatsApp (`representatives/presentation/commercial-pages/whatsapp-icon.tsx`)
 * — para não introduzir uma marca de terceiro numa peça pensada para
 * circular publicamente fora do contexto controlado da Commercial Page. Cor
 * herdada via `currentColor`.
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
