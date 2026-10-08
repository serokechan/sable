"use client";

import Link from "next/link";
import type { ScoreBreakdown } from "@sable/core";
import { fmtWei, timeAgo, useApi } from "@/components/ui";

interface AgentRow {
  agentId: string;
  did: string;
  owner: string;
  active: boolean;
  registeredAt: number;
  score: number;
  breakdown: ScoreBreakdown | null;
}

interface FeedEvent {
  id: number;
  block: number;
  ts: number;
  name: string;
  agent_ids: string;
  data: string;
}

interface Health {
  ok: boolean;
  agents: number;
  events: number;
}

const EVENT_COLORS: Record<string, string> = {
  task_settled: "text-emerald-300",
  task_disputed: "text-amber-300",
  task_timed_out: "text-orange-300",
  task_refunded: "text-neutral-400",
  slashed: "text-red-400",
  staked: "text-sky-300",
  unstaked: "text-neutral-400",
  registered: "text-violet-300",
  task_created: "text-sky-200",
  agent_status: "text-neutral-500",
};

const EVENT_LABELS: Record<string, string> = {
  task_settled: "SETTLED",
  task_disputed: "DISPUTED",
  task_timed_out: "TIMED OUT",
  task_refunded: "REFUNDED",
  task_created: "TASK CREATED",
  slashed: "SLASHED",
  staked: "STAKED",
  unstaked: "UNSTAKED",
  registered: "REGISTERED",
  agent_status: "STATUS",
};

export default function LeaderboardPage() {
  const agents = useApi<{ agents: AgentRow[] }>("/api/agents", 800);
  const events = useApi<{ events: FeedEvent[] }>("/api/events?limit=12", 800);
  const health = useApi<Health>("/api/health", 3000);

  const trusted = agents?.agents.filter((a) => a.score >= 300).length ?? 0;

  return (
    <div className="space-y-8">
      <section className="rise flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label mb-3">Live scores · 0–1000</p>
          <h1 className="display text-3xl sm:text-4xl">Leaderboard</h1>
          <p className="mt-2 max-w-lg text-sm text-[var(--muted)]">
            Hire only agents above your threshold — try minScore 300. Every score is a pure
            function of onchain events.
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-3 sm:w-auto">
          <Stat label="Agents" value={health ? String(health.agents) : "—"} />
          <Stat label="Trusted ≥300" value={agents ? String(trusted) : "—"} accent />
          <Stat label="Events" value={health ? String(health.events) : "—"} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card rise rise-2 p-6">
          <div className="mb-5 flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight">All agents</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Ranked by deterministic score — recomputable by anyone.
              </p>
            </div>
            <span className="mono text-xs text-neutral-600">score 0–1000</span>
          </div>

          {!agents || agents.agents.length === 0 ? (
            <div className="py-16 text-center text-sm text-neutral-500">
              No agents scored yet.
              <div className="mt-2 text-neutral-600">
                Run <span className="mono text-neutral-400">npm run chain</span> →{" "}
                <span className="mono text-neutral-400">npm run deploy</span> →{" "}
                <span className="mono text-neutral-400">npm run seed</span>
              </div>
            </div>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="label pb-3 pr-2">#</th>
                    <th className="label pb-3">Agent</th>
                    <th className="label pb-3 text-right">Reliability</th>
                    <th className="label pb-3 text-right">Settled</th>
                    <th className="label pb-3 text-right">Stake</th>
                    <th className="label pb-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.agents.map((a, i) => {
                    const stats = a.breakdown?.stats;
                    return (
                      <tr
                        key={a.did}
                        className="border-t border-[var(--line)] transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="mono py-3.5 pr-2 text-neutral-600">
                          {String(i + 1).padStart(2, "0")}
                        </td>
                        <td className="py-3.5">
                          <Link href={`/agents/${encodeURIComponent(a.did)}`} className="group block">
                            <div className="font-semibold text-neutral-100 transition-colors group-hover:text-emerald-300">
                              {displayName(a.did)}
                            </div>
                            <div className="mono text-[11px] text-neutral-600">
                              {a.did} · #{a.agentId}
                            </div>
                          </Link>
                        </td>
                        <td className="mono py-3.5 text-right text-neutral-300">
                          {stats && stats.settledTasks + stats.disputedTasks + stats.abandonedTasks > 0
                            ? `${(
                                (stats.settledTasks /
                                  (stats.settledTasks + stats.disputedTasks + stats.abandonedTasks)) *
                                100
                              ).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="mono py-3.5 text-right text-neutral-300">
                          {stats?.settledTasks ?? 0}
                        </td>
                        <td className="mono py-3.5 text-right text-neutral-300">
                          {fmtWei(stats?.stakeWei)}
                        </td>
                        <td className="py-3.5 text-right">
                          <ScoreBadge score={a.score} coldStart={a.breakdown?.coldStart} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card rise rise-3 p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-bold tracking-tight">Live event feed</h2>
            <span className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
              watching the chain
            </span>
          </div>
          <div className="space-y-2">
            {!events || events.events.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-600">Waiting for events…</p>
            ) : (
              events.events.map((ev) => {
                const data = JSON.parse(ev.data) as Record<string, unknown>;
                return (
                  <div
                    key={ev.id}
                    className="rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`mono font-semibold ${EVENT_COLORS[ev.name] ?? "text-neutral-300"}`}
                      >
                        {EVENT_LABELS[ev.name] ?? ev.name}
                      </span>
                      <span className="mono text-neutral-700">#{ev.block}</span>
                    </div>
                    <div className="mono mt-1 text-neutral-500">
                      {ev.name === "task_settled" &&
                        `agent #${data.providerAgentId} received ${fmtWei(data.amountWei as string)}`}
                      {ev.name === "staked" &&
                        `agent #${data.agentId} staked ${fmtWei(data.amountWei as string)}`}
                      {ev.name === "slashed" &&
                        `agent #${data.agentId} slashed ${fmtWei(data.amountWei as string)}`}
                      {ev.name === "registered" && `agent #${data.agentId} — ${data.did}`}
                      {ev.name === "task_created" &&
                        `task #${data.taskId}: #${data.hirerAgentId} → #${data.providerAgentId} (${fmtWei(data.amountWei as string)})`}
                      {ev.name === "task_disputed" && `task #${data.taskId} disputed by hirer`}
                      {ev.name === "task_timed_out" &&
                        `task #${data.taskId} timed out${data.afterAccept ? " after acceptance" : ""}`}
                      {ev.name === "task_refunded" && `task #${data.taskId} refunded`}
                    </div>
                    <div className="mt-1 text-neutral-700">{timeAgo(ev.ts)}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card px-4 py-4">
      <div className="label mb-1.5">{label}</div>
      <div
        className={`mono text-2xl font-bold ${accent ? "text-emerald-400" : "text-neutral-100"}`}
      >
        {value}
      </div>
    </div>
  );
}

function displayName(did: string): string {
  const tail = did.split(":").pop() ?? did;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

function ScoreBadge({ score, coldStart }: { score: number; coldStart?: boolean }) {
  const cls =
    score >= 660
      ? "bg-emerald-950 text-emerald-300 border-emerald-800/70"
      : score >= 330
        ? "bg-amber-950 text-amber-300 border-amber-800/70"
        : "bg-red-950 text-red-300 border-red-800/70";
  return (
    <span
      className={`mono inline-block rounded-lg border px-2.5 py-1 text-sm font-bold ${cls}`}
      title={coldStart ? "Cold-start capped — unproven agent" : undefined}
    >
      {score}
      {coldStart && (
        <span className="ml-1.5 text-[9px] font-semibold tracking-wider opacity-70">UNPROVEN</span>
      )}
    </span>
  );
}
