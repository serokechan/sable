"use client";

import { timeAgo, useApi } from "@/components/ui";

interface FeedEvent {
  id: number;
  block: number;
  ts: number;
  name: string;
  agent_ids: string;
  data: string;
}

const EVENT_LABELS: Record<string, string> = {
  task_settled: "SETTLED",
  task_disputed: "DISPUTED",
  task_timed_out: "TIMED OUT",
  task_refunded: "REFUNDED",
  task_created: "CREATED",
  slashed: "SLASHED",
  staked: "STAKED",
  unstaked: "UNSTAKED",
  registered: "REGISTERED",
  agent_status: "STATUS",
};

const EVENT_TONE: Record<string, string> = {
  task_settled: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
  task_disputed: "border-amber-800/60 bg-amber-950/40 text-amber-300",
  task_timed_out: "border-orange-800/60 bg-orange-950/40 text-orange-300",
  slashed: "border-red-800/60 bg-red-950/40 text-red-300",
  staked: "border-sky-800/60 bg-sky-950/40 text-sky-300",
  registered: "border-violet-800/60 bg-violet-950/40 text-violet-300",
  task_created: "border-sky-800/60 bg-sky-950/40 text-sky-300",
};

function describe(name: string, data: Record<string, unknown>): string {
  switch (name) {
    case "registered":
      return `did ${data.did} · owner ${data.owner} · agent #${data.agentId}`;
    case "agent_status":
      return `agent #${data.agentId} → ${data.active ? "active" : "inactive"}`;
    case "staked":
      return `agent #${data.agentId} staked ${fmt(data.amountWei)}`;
    case "unstaked":
      return `agent #${data.agentId} unstaked ${fmt(data.amountWei)}`;
    case "slashed":
      return `agent #${data.agentId} slashed ${fmt(data.amountWei)} · evidence ${String(data.evidenceHash).slice(0, 14)}…`;
    case "task_created":
      return `task #${data.taskId} · hirer #${data.hirerAgentId} → provider #${data.providerAgentId} · ${fmt(data.amountWei)}`;
    case "task_settled":
      return `task #${data.taskId} · provider #${data.providerAgentId} paid ${fmt(data.amountWei)}`;
    case "task_disputed":
      return `task #${data.taskId} disputed · provider #${data.providerAgentId}`;
    case "task_refunded":
      return `task #${data.taskId} refunded · provider #${data.providerAgentId}${data.afterAccept ? " · after acceptance" : " · pre-acceptance"}`;
    case "task_timed_out":
      return `task #${data.taskId} timed out · provider #${data.providerAgentId}${data.afterAccept ? " · abandoned" : " · pre-acceptance"}`;
    default:
      return JSON.stringify(data);
  }
}

const fmt = (wei: unknown) =>
  wei === undefined
    ? "—"
    : (Number(BigInt(String(wei))) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function ExplorerPage() {
  const events = useApi<{ events: FeedEvent[] }>("/api/events?limit=200", 1000);

  return (
    <div className="space-y-6">
      <section className="rise max-w-2xl">
        <p className="label mb-3">Transparency</p>
        <h1 className="display text-3xl sm:text-4xl">Reputation explorer</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Every event feeding every score — raw, ordered, public. This is the full input set of
          the scoring engine. Anything not on this page does not exist to the scorer.
        </p>
      </section>

      <div className="card divide-y divide-[var(--line)] overflow-hidden">
        {!events || events.events.length === 0 ? (
          <p className="p-10 text-center text-sm text-neutral-600">
            No events yet — run the seed or fire the demo.
          </p>
        ) : (
          events.events.map((ev) => {
            const data = JSON.parse(ev.data) as Record<string, unknown>;
            return (
              <div
                key={ev.id}
                className="flex items-center gap-3 px-5 py-3 text-xs transition-colors hover:bg-white/[0.02]"
              >
                <span
                  className={`mono w-24 shrink-0 rounded-md border px-1.5 py-0.5 text-center text-[10px] font-bold ${
                    EVENT_TONE[ev.name] ?? "border-neutral-700 bg-neutral-900 text-neutral-400"
                  }`}
                >
                  {EVENT_LABELS[ev.name] ?? ev.name}
                </span>
                <span className="mono min-w-0 flex-1 truncate text-neutral-500">
                  {describe(ev.name, data)}
                </span>
                <span className="mono hidden shrink-0 text-neutral-700 sm:block">
                  #{ev.block}
                </span>
                <span className="mono w-16 shrink-0 text-right text-neutral-700">
                  {timeAgo(ev.ts)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
