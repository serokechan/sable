import Link from "next/link";

export interface TopAgent {
  agentId: string;
  did: string;
  score: number;
  coldStart?: boolean;
}

export function TopAgents({ agents, error }: { agents: TopAgent[]; error?: boolean }) {
  if (error) {
    return <p className="py-10 text-center text-sm text-neutral-600">Unavailable right now.</p>;
  }
  if (agents.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-600">No agents scored yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {agents.map((a, i) => (
        <li key={a.did}>
          <Link
            href={`/agents/${encodeURIComponent(a.did)}`}
            className="group flex items-center gap-3 rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2.5 transition-colors hover:border-neutral-700"
          >
            <span className="mono w-5 text-[11px] text-neutral-600">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-neutral-100 transition-colors group-hover:text-accent">
                {displayName(a.did)}
              </span>
              <span className="mono block truncate text-[10px] text-neutral-600">{a.did}</span>
            </span>
            <ScorePill score={a.score} coldStart={a.coldStart} />
          </Link>
        </li>
      ))}
    </ol>
  );
}

function displayName(did: string): string {
  const tail = did.split(":").pop() ?? did;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

function ScorePill({ score, coldStart }: { score: number; coldStart?: boolean }) {
  const cls =
    score >= 660
      ? "bg-emerald-950 text-emerald-300 border-emerald-800/70"
      : score >= 330
        ? "bg-amber-950 text-amber-300 border-amber-800/70"
        : "bg-red-950 text-red-300 border-red-800/70";
  return (
    <span
      className={`mono shrink-0 rounded-lg border px-2 py-1 text-xs font-bold ${cls}`}
      title={coldStart ? "Cold-start capped — unproven agent" : undefined}
    >
      {score}
      {coldStart && (
        <span className="ml-1 text-[8px] font-semibold tracking-wider opacity-70">UNPROVEN</span>
      )}
    </span>
  );
}
