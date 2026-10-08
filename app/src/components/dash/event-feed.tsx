import { fmtWei, timeAgo } from "@/lib/format";

export interface FeedEvent {
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
  slashed: "SLASHED",
  staked: "STAKED",
  unstaked: "UNSTAKED",
  registered: "REGISTERED",
  task_created: "CREATED",
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
      return `did ${data.did} · agent #${data.agentId}`;
    case "staked":
      return `agent #${data.agentId} staked ${fmtWei(String(data.amountWei))}`;
    case "unstaked":
      return `agent #${data.agentId} unstaked ${fmtWei(String(data.amountWei))}`;
    case "slashed":
      return `agent #${data.agentId} slashed ${fmtWei(String(data.amountWei))}`;
    case "task_created":
      return `task #${data.taskId} · #${data.hirerAgentId} → #${data.providerAgentId} · ${fmtWei(String(data.amountWei))}`;
    case "task_settled":
      return `task #${data.taskId} · provider #${data.providerAgentId} paid ${fmtWei(String(data.amountWei))}`;
    case "task_disputed":
      return `task #${data.taskId} disputed · provider #${data.providerAgentId}`;
    case "task_refunded":
      return `task #${data.taskId} refunded · provider #${data.providerAgentId}`;
    case "task_timed_out":
      return `task #${data.taskId} timed out · provider #${data.providerAgentId}`;
    case "agent_status":
      return `agent #${data.agentId} → ${data.active ? "active" : "inactive"}`;
    default:
      return name;
  }
}

export function EventFeed({
  events,
  error,
}: {
  events: FeedEvent[];
  error?: boolean;
}) {
  if (error) {
    return <p className="py-10 text-center text-sm text-neutral-600">Feed unavailable right now.</p>;
  }
  if (events.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-600">
        No events yet — run the seed or fire the demo.
      </p>
    );
  }

  return (
    <div className="divide-y divide-[var(--line)]">
      {events.map((ev) => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(ev.data) as Record<string, unknown>;
        } catch {
          /* keep empty */
        }
        return (
          <div
            key={ev.id}
            className="flex items-center gap-3 px-1 py-2.5 text-xs first:pt-0 last:pb-0"
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
            <span className="mono hidden shrink-0 text-neutral-700 sm:block">#{ev.block}</span>
            <span className="mono w-16 shrink-0 text-right text-neutral-700">{timeAgo(ev.ts)}</span>
          </div>
        );
      })}
    </div>
  );
}
