export default function ContactsLoading() {
  return (
    <div className="space-y-7" aria-label="Carregando contatos" role="status">
      <div className="space-y-3">
        <div className="h-10 w-40 animate-pulse rounded-md bg-surface-raised" />
        <div className="h-5 w-full max-w-xl animate-pulse rounded bg-surface-raised" />
      </div>
      <div className="grid gap-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-56 animate-pulse rounded-lg border border-line bg-surface-raised" />
        ))}
      </div>
      <span className="sr-only">Carregando contatos…</span>
    </div>
  );
}
