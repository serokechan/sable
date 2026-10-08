export function StatCard({
  label,
  value,
  hint,
  accent,
  error,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  error?: boolean;
}) {
  return (
    <div className="card px-4 py-4">
      <div className="label mb-1.5">{label}</div>
      <div
        className={`mono text-2xl font-bold ${
          error ? "text-[var(--bad)]" : accent ? "text-accent" : "text-neutral-100"
        }`}
      >
        {error ? "—" : value}
      </div>
      {hint ? <div className="mono mt-1 truncate text-[11px] text-neutral-600">{hint}</div> : null}
    </div>
  );
}
