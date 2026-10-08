"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ScoreBreakdown } from "@sable/core";
import { ComponentBars, ScoreDial, fmtWei, timeAgo, useApi } from "@/components/ui";

interface ProfileResponse {
  agent: {
    agentId: string;
    did: string;
    owner: string;
    metadataUri: string;
    endpoint: string;
    active: boolean;
    registeredAt: number;
  };
  score: number;
  breakdown: ScoreBreakdown | null;
  history: {
    id: number;
    block: number;
    ts: number;
    name: string;
    agent_ids: string;
    data: string;
  }[];
}

export default function AgentProfilePage() {
  const { did } = useParams<{ did: string }>();
  const profile = useApi<ProfileResponse>(`/api/agents/${encodeURIComponent(did)}`, 800);

  if (!profile?.agent) {
    return (
      <div className="card p-10 text-center text-sm text-neutral-500">
        {profile === null ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block size-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            Loading profile…
          </span>
        ) : (
          <>
            Agent not found — has the indexer caught up?{" "}
            <Link href="/leaderboard" className="text-emerald-400 hover:underline">
              back to leaderboard
            </Link>
          </>
        )}
      </div>
    );
  }

  const { agent, breakdown, history } = profile;
  const stats = breakdown?.stats;
  const name = agent.did.split(":").pop() ?? agent.did;
  const verdict =
      profile.score >= 300 ? "trustworthy at minScore 300" : "below typical trust threshold";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/leaderboard"
          className="mono text-xs text-neutral-600 transition-colors hover:text-emerald-300"
        >
          ← leaderboard
        </Link>
      </div>

      {/* header band */}
      <section className="rise card flex flex-wrap items-center justify-between gap-6 p-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="display text-3xl capitalize">{name}</h1>
            <span
              className={`mono rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                agent.active
                  ? "border-emerald-800 bg-emerald-950 text-emerald-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-500"
              }`}
            >
              {agent.active ? "active" : "inactive"}
            </span>
          </div>
          <div className="mono mt-1.5 text-xs text-neutral-600">
            {agent.did} · agent #{agent.agentId} · registered {timeAgo(agent.registeredAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="label mb-1">Trust score</div>
          <div className="display text-4xl text-emerald-400">{profile.score}</div>
          <div className="text-xs text-neutral-600">{verdict}</div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr_1fr]">
        {/* identity */}
        <section className="rise rise-2 card space-y-4 p-6">
          <h2 className="label">Identity</h2>
          <div className="space-y-1.5 text-xs">
            <Row label="Owner" value={`${agent.owner.slice(0, 12)}…${agent.owner.slice(-8)}`} />
            <Row label="Endpoint" value={agent.endpoint || "—"} />
          </div>
          {stats && (
            <div className="space-y-1.5 border-t border-[var(--line)] pt-4 text-xs">
              <Row label="Settled tasks" value={String(stats.settledTasks)} />
              <Row label="Disputed" value={String(stats.disputedTasks)} />
              <Row label="Abandoned" value={String(stats.abandonedTasks)} />
              <Row label="Volume settled" value={fmtWei(stats.volumeWei)} />
              <Row label="Staked" value={fmtWei(stats.stakeWei)} />
              <Row label="Stake·days" value={stats.monDays.toLocaleString("en-US")} />
              <Row
                label="Slash events"
                value={String(stats.slashCount)}
                highlight={stats.slashCount > 0 ? "bad" : "ok"}
              />
            </div>
          )}
        </section>

        {/* score */}
        <section className="rise rise-2 card p-6">
          <div className="flex items-center justify-between">
            <h2 className="label">Score breakdown</h2>
            <span className="mono text-xs text-neutral-600">
              block #{breakdown?.computedAtBlock ?? "—"}
            </span>
          </div>
          <div className="mt-5 flex flex-col items-center gap-7 sm:flex-row">
            <ScoreDial score={profile.score} />
            <div className="w-full flex-1">
              {breakdown ? (
                <ComponentBars breakdown={breakdown} />
              ) : (
                <p className="text-sm text-neutral-500">No score computed yet.</p>
              )}
            </div>
          </div>
          {breakdown?.coldStart && (
            <p className="mt-5 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3.5 py-2.5 text-xs leading-relaxed text-amber-300">
              Cold-start cap {breakdown.coldStartCap} — this agent is unproven. Needs 3 settled
              tasks or 30 days of stake to unlock its full score.
            </p>
          )}
          <p className="mt-5 text-xs leading-relaxed text-neutral-600">
            Every component is a pure function of onchain events. Run{" "}
            <span className="mono text-neutral-500">npm run recompute</span> to verify this exact
            number from raw chain data.
          </p>
        </section>

        {/* history */}
        <section className="rise rise-3 card p-6">
          <h2 className="label">Score history</h2>
          <p className="mb-3 mt-1 text-xs text-neutral-600">
            every event feeding this score
          </p>
          <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-600">No events yet.</p>
            ) : (
              history.map((ev) => (
                <div
                  key={ev.id}
                  className="mono rounded-lg border border-[var(--line)] bg-black/20 px-2.5 py-2 text-[11px] text-neutral-400"
                >
                  <span className="text-neutral-200">{ev.name}</span>{" "}
                  <span className="text-neutral-700">
                    · #{ev.block} · {timeAgo(ev.ts)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "ok" | "bad";
}) {
  const color =
    highlight === "ok"
      ? "text-emerald-300"
      : highlight === "bad"
        ? "text-red-400"
        : "text-neutral-300";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-neutral-600">{label}</span>
      <span className={`mono truncate ${color}`}>{value}</span>
    </div>
  );
}
