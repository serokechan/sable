import type { Metadata } from "next";
import Link from "next/link";
import type { ScoreBreakdown } from "@sable/core";
import { EventFeed, type FeedEvent } from "@/components/dash/event-feed";
import { RefreshButton } from "@/components/dash/refresh-button";
import { StatCard } from "@/components/dash/stat-card";
import { TopAgents, type TopAgent } from "@/components/dash/top-agents";
import { TrendChart } from "@/components/dash/trend-chart";
import { getRuntime } from "@/server/runtime";
import { buildDailyBuckets } from "@/lib/trend";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard · Sable",
  description: "Network health, top agents, trend, and live events at a glance.",
};

interface HealthSnap {
  chainId: number;
  agents: number;
  events: number;
}

interface AgentsSnap {
  top: TopAgent[];
  avgScore: number;
  active: number;
}

async function loadHealth(): Promise<HealthSnap | null> {
  try {
    const { db, addresses } = getRuntime();
    return {
      chainId: addresses.chainId,
      agents: db.listAgents().length,
      events: db.countEvents(),
    };
  } catch {
    return null;
  }
}

async function loadAgents(): Promise<AgentsSnap | null> {
  try {
    const { db } = getRuntime();
    const rows = db
      .listAgents()
      .map((a) => {
        const s = db.getScore(a.agent_id);
        const breakdown: ScoreBreakdown | null = s ? JSON.parse(s.breakdown) : null;
        return {
          agentId: a.agent_id,
          did: a.did,
          score: s?.score ?? 0,
          coldStart: breakdown?.coldStart ?? false,
          active: a.active === 1,
        };
      })
      .sort((x, y) => y.score - x.score);

    const avgScore =
      rows.length === 0
        ? 0
        : Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length);

    return {
      top: rows.slice(0, 5),
      avgScore,
      active: rows.filter((r) => r.active).length,
    };
  } catch {
    return null;
  }
}

async function loadFeedAndTrend(): Promise<{ feed: FeedEvent[]; trend: ReturnType<typeof buildDailyBuckets> } | null> {
  try {
    const { db } = getRuntime();
    const feed = db.recentEvents(10);
    const recent = db.recentEvents(500);
    const now = Math.floor(Date.now() / 1000);
    const latest = recent.reduce((maxTs, e) => Math.max(maxTs, e.ts), now);
    const trend = buildDailyBuckets(recent, latest, 14);
    return { feed, trend };
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const [health, agents, chain] = await Promise.all([
    loadHealth(),
    loadAgents(),
    loadFeedAndTrend(),
  ]);

  const networkHint =
    health == null
      ? "contracts not loaded"
      : health.chainId === 31337
        ? "anvil · local"
        : health.chainId === 10143
          ? "monad · testnet"
          : `chain ${health.chainId}`;

  return (
    <div className="space-y-6">
      <section className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label mb-3">Overview</p>
          <h1 className="display text-3xl sm:text-4xl">Dashboard</h1>
          <p className="mt-2 max-w-lg text-sm text-[var(--muted)]">
            Network health, reputation leaders, and the raw event stream — one screen.
          </p>
        </div>
        <RefreshButton />
      </section>

      <section className="rise rise-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Network"
          value={health ? String(health.chainId) : "—"}
          hint={networkHint}
          error={!health}
        />
        <StatCard
          label="Agents"
          value={health ? String(health.agents) : "—"}
          hint={agents ? `${agents.active} active` : undefined}
          error={!health}
        />
        <StatCard
          label="Events"
          value={health ? String(health.events) : "—"}
          hint="onchain, indexed"
          error={!health}
        />
        <StatCard
          label="Avg score"
          value={agents && agents.top.length > 0 ? String(agents.avgScore) : "—"}
          hint="0–1000 · deterministic"
          accent
          error={!agents}
        />
      </section>

      <section className="rise rise-2 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Activity · 14 days</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                task_created + task_settled per UTC day — the engine input.
              </p>
            </div>
            <Link
              href="/explorer"
              className="mono shrink-0 text-xs text-accent transition-opacity hover:opacity-80"
            >
              Explorer →
            </Link>
          </div>
          <TrendChart buckets={chain?.trend ?? []} error={!chain} />
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Top agents</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">Highest live score right now.</p>
            </div>
            <Link
              href="/leaderboard"
              className="mono shrink-0 text-xs text-accent transition-opacity hover:opacity-80"
            >
              Leaderboard →
            </Link>
          </div>
          <TopAgents agents={agents?.top ?? []} error={!agents} />
        </div>
      </section>

      <section className="rise rise-3 card p-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Live event feed</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Latest 10 events — full score input set.
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
            watching the chain
          </span>
        </div>
        <EventFeed events={chain?.feed ?? []} error={!chain} />
        <div className="mt-4 border-t border-[var(--line)] pt-3 text-right">
          <Link
            href="/explorer"
            className="mono text-xs text-accent transition-opacity hover:opacity-80"
          >
            Buka explorer →
          </Link>
        </div>
      </section>
    </div>
  );
}
