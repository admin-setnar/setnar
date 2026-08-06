export default function AppLoading() {
  return (
    <div className="space-y-6" aria-label="Carregando conteúdo" role="status">
      <div className="h-9 w-48 animate-pulse rounded-md bg-surface-raised" />
      <div className="h-32 animate-pulse rounded-lg border border-line bg-surface-raised" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
