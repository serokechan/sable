/**
 * Sable deterministic scoring engine.
 *
 * score(agent) ∈ [0, 1000] is a PURE function of the normalized onchain event
 * stream. Given the same events (sorted by block, then log index) and the same
 * `nowTs`, any recompute produces the identical number. No admin key, no
 * offchain opinions, no LLM judgment.
 *
 * Component weights (from PRD §7):
 *   reliability  300   volume-weighted settled / (settled + disputed + abandoned)
 *   activity     250   log-scaled settled task count + transacted volume
 *   stake        200   log-scaled MON·days actively staked
 *   attestations 150   P1 (bonded reviews) — reserved, 0 in P0
 *   tenure       100   identity age + recency of activity
 *   slash        -150  per slash event, floored at 0
 *
 * Cold-start rule: a fresh agent caps at 190 until it has 3 settled tasks OR
 * 30 days of stake history. Unproven ≠ trusted.
 */

import type { AgentId, ScoreBreakdown, ScoreEvent, ScoreMap, ScoreStats } from "./types.js";

export const SCORING_WEIGHTS = {
  reliability: 300,
  activity: 250,
  stake: 200,
  attestations: 150,
  tenure: 100,
  slashPenalty: 150,
} as const;

export const SCORING_SCALE = {
  /** settled-task count that reaches full activity score */
  activityTasks: 50,
  /** transacted volume (whole units) that reaches full activity score */
  activityVolume: 1000,
  /** MON·days that reaches full stake score */
  stakeMonDays: 3000,
  /** identity age in days that reaches full tenure score */
  tenureDays: 30,
  /** recency window in days */
  recencyWindow: 7,
  coldStartCap: 190,
  coldStartSettled: 3,
  coldStartStakeDays: 30,
} as const;

const DAY = 86_400;

const log2 = (n: number) => Math.log(n) / Math.LN2;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

type TaskOutcome = "settled" | "disputed" | "abandoned" | "open_dispute" | "neutral" | "pending";

interface AgentAccumulator {
  did: string | null;
  registeredAt: number | null;
  settled: { count: number; volumeWei: bigint };
  disputed: { count: number; volumeWei: bigint };
  abandoned: { count: number; volumeWei: bigint };
  openDisputes: number;
  slashCount: number;
  stakeWei: bigint;
  stakeLedger: { ts: number; deltaWei: bigint }[]; // deltas applied in ts order
  firstStakeTs: number | null;
  lastActivityTs: number | null;
}

function newAcc(): AgentAccumulator {
  return {
    did: null,
    registeredAt: null,
    settled: { count: 0, volumeWei: 0n },
    disputed: { count: 0, volumeWei: 0n },
    abandoned: { count: 0, volumeWei: 0n },
    openDisputes: 0,
    slashCount: 0,
    stakeWei: 0n,
    stakeLedger: [],
    firstStakeTs: null,
    lastActivityTs: null,
  };
}

function markActivity(acc: AgentAccumulator, ts: number) {
  if (acc.lastActivityTs === null || ts > acc.lastActivityTs) acc.lastActivityTs = ts;
}

/**
 * Compute scores for every agent appearing in `events`, from the event stream only.
 * `events` must be ordered by (block, then original log order) — the indexer guarantees this.
 * `nowTs` is the reference timestamp (last processed block timestamp in production).
 */
export function computeScores(events: ScoreEvent[], nowTs: number): ScoreMap {
  const agents = new Map<AgentId, AgentAccumulator>();
  const tasks = new Map<string, { providerAgentId: AgentId; amountWei: bigint; outcome: TaskOutcome }>();

  const acc = (id: AgentId): AgentAccumulator => {
    let a = agents.get(id);
    if (!a) {
      a = newAcc();
      agents.set(id, a);
    }
    return a;
  };

  for (const ev of events) {
    switch (ev.kind) {
      case "registered": {
        const a = acc(ev.agentId);
        a.did = ev.did;
        if (a.registeredAt === null) a.registeredAt = ev.ts;
        break;
      }
      case "agent_status":
        acc(ev.agentId); // recognized but not directly scored in P0
        break;
      case "staked": {
        const a = acc(ev.agentId);
        const amt = BigInt(ev.amountWei);
        a.stakeWei += amt;
        a.stakeLedger.push({ ts: ev.ts, deltaWei: amt });
        if (a.firstStakeTs === null || ev.ts < a.firstStakeTs) a.firstStakeTs = ev.ts;
        markActivity(a, ev.ts);
        break;
      }
      case "unstaked": {
        const a = acc(ev.agentId);
        const amt = BigInt(ev.amountWei);
        a.stakeWei -= amt;
        a.stakeLedger.push({ ts: ev.ts, deltaWei: -amt });
        break;
      }
      case "slashed": {
        const a = acc(ev.agentId);
        const amt = BigInt(ev.amountWei);
        a.stakeWei -= amt;
        a.stakeLedger.push({ ts: ev.ts, deltaWei: -amt });
        a.slashCount += 1;
        markActivity(a, ev.ts);
        break;
      }
      case "task_created": {
        tasks.set(ev.taskId, {
          providerAgentId: ev.providerAgentId,
          amountWei: BigInt(ev.amountWei),
          outcome: "pending",
        });
        break;
      }
      case "task_settled": {
        const t = tasks.get(ev.taskId);
        const provider = t?.providerAgentId ?? ev.providerAgentId;
        const amount = t?.amountWei ?? BigInt(ev.amountWei);
        const prev = t?.outcome;
        if (prev === "open_dispute") {
          const a = acc(provider);
          a.openDisputes = Math.max(0, a.openDisputes - 1);
        }
        tasks.set(ev.taskId, { providerAgentId: provider, amountWei: amount, outcome: "settled" });
        const a = acc(provider);
        a.settled.count += 1;
        a.settled.volumeWei += amount;
        markActivity(a, ev.ts);
        break;
      }
      case "task_disputed": {
        const t = tasks.get(ev.taskId);
        const provider = t?.providerAgentId ?? ev.providerAgentId;
        const amount = t?.amountWei ?? 0n;
        tasks.set(ev.taskId, { providerAgentId: provider, amountWei: amount, outcome: "open_dispute" });
        acc(provider).openDisputes += 1;
        markActivity(acc(provider), ev.ts);
        break;
      }
      case "task_refunded": {
        const t = tasks.get(ev.taskId);
        const provider = t?.providerAgentId ?? ev.providerAgentId;
        const amount = t?.amountWei ?? 0n;
        const prev = t?.outcome;
        if (prev === "open_dispute") {
          const a = acc(provider);
          a.openDisputes = Math.max(0, a.openDisputes - 1);
        }
        tasks.set(ev.taskId, {
          providerAgentId: provider,
          amountWei: amount,
          outcome: ev.afterAccept ? "disputed" : "neutral",
        });
        if (ev.afterAccept) {
          const a = acc(provider);
          a.disputed.count += 1;
          a.disputed.volumeWei += amount;
          markActivity(a, ev.ts);
        }
        break;
      }
      case "task_timed_out": {
        const t = tasks.get(ev.taskId);
        const provider = t?.providerAgentId ?? ev.providerAgentId;
        const amount = t?.amountWei ?? 0n;
        const prev = t?.outcome;
        if (prev === "open_dispute") {
          const a = acc(provider);
          a.openDisputes = Math.max(0, a.openDisputes - 1);
        }
        tasks.set(ev.taskId, {
          providerAgentId: provider,
          amountWei: amount,
          outcome: ev.afterAccept ? "abandoned" : "neutral",
        });
        if (ev.afterAccept) {
          const a = acc(provider);
          a.abandoned.count += 1;
          a.abandoned.volumeWei += amount;
          markActivity(a, ev.ts);
        }
        break;
      }
    }
  }

  const result: ScoreMap = {};
  for (const [agentId, a] of agents) {
    result[agentId] = scoreAgent(agentId, a, tasks, nowTs);
  }
  return result;
}

function scoreAgent(
  agentId: AgentId,
  a: AgentAccumulator,
  tasks: Map<string, { providerAgentId: AgentId; amountWei: bigint; outcome: TaskOutcome }>,
  nowTs: number,
): ScoreBreakdown {
  // --- reliability (volume-weighted) ---
  const goodVol = a.settled.volumeWei;
  const badVol = a.disputed.volumeWei + a.abandoned.volumeWei;
  const reliability =
    goodVol + badVol > 0n
      ? (Number(goodVol) / Number(goodVol + badVol)) * SCORING_WEIGHTS.reliability
      : 0;

  // --- activity (log-scaled count + volume) ---
  const ethVolume = Number(a.settled.volumeWei) / 1e18;
  const activityTaskPart = log2(1 + a.settled.count) / log2(1 + SCORING_SCALE.activityTasks);
  const activityVolumePart = log2(1 + ethVolume) / log2(1 + SCORING_SCALE.activityVolume);
  const activity =
    SCORING_WEIGHTS.activity * Math.min(1, 0.5 * activityTaskPart + 0.5 * activityVolumePart);

  // --- stake: integrate the stake ledger into MON·days ---
  const ledger = [...a.stakeLedger].sort((x, y) => x.ts - y.ts || 0);
  let monDays = 0;
  let balance = 0n;
  let prevTs = ledger.length > 0 ? ledger[0].ts : nowTs;
  for (const entry of ledger) {
    if (entry.ts > prevTs && balance > 0n) {
      monDays += (Number(balance) / 1e18) * ((entry.ts - prevTs) / DAY);
    }
    balance += entry.deltaWei;
    if (balance < 0n) balance = 0n;
    prevTs = entry.ts;
  }
  if (balance > 0n && nowTs > prevTs) {
    monDays += (Number(balance) / 1e18) * ((nowTs - prevTs) / DAY);
  }
  const stakeScore =
    SCORING_WEIGHTS.stake * Math.min(1, log2(1 + monDays) / log2(1 + SCORING_SCALE.stakeMonDays));

  // --- tenure & recency ---
  const tenureDays = a.registeredAt !== null ? Math.max(0, (nowTs - a.registeredAt) / DAY) : 0;
  const recent = a.lastActivityTs !== null && nowTs - a.lastActivityTs <= SCORING_SCALE.recencyWindow * DAY;
  const tenure =
    SCORING_WEIGHTS.tenure *
    (0.5 * Math.min(1, tenureDays / SCORING_SCALE.tenureDays) + 0.5 * (recent ? 1 : 0));

  // --- slash penalty ---
  const slashPenalty = SCORING_WEIGHTS.slashPenalty * a.slashCount;

  // --- cold start ---
  const stakeSpanDays = a.firstStakeTs !== null ? Math.max(0, (nowTs - a.firstStakeTs) / DAY) : 0;
  const coldStart = a.settled.count < SCORING_SCALE.coldStartSettled && stakeSpanDays < SCORING_SCALE.coldStartStakeDays;

  let raw =
    reliability + activity + stakeScore + tenure + SCORING_WEIGHTS.attestations * 0 - slashPenalty;
  if (coldStart) raw = Math.min(raw, SCORING_SCALE.coldStartCap);

  const stats: ScoreStats = {
    settledTasks: a.settled.count,
    disputedTasks: a.disputed.count,
    abandonedTasks: a.abandoned.count,
    openDisputes: a.openDisputes,
    volumeWei: a.settled.volumeWei.toString(),
    stakeWei: a.stakeWei.toString(),
    monDays: Math.round(monDays * 1000) / 1000,
    tenureDays: Math.round(tenureDays * 1000) / 1000,
    recentActivity: recent,
    slashCount: a.slashCount,
  };

  return {
    agentId,
    did: a.did,
    score: clamp(Math.round(raw), 0, 1000),
    components: {
      reliability: Math.round(reliability * 10) / 10,
      activity: Math.round(activity * 10) / 10,
      stake: Math.round(stakeScore * 10) / 10,
      attestations: 0,
      slashPenalty: -slashPenalty,
      tenure: Math.round(tenure * 10) / 10,
    },
    coldStart,
    coldStartCap: SCORING_SCALE.coldStartCap,
    stats,
    computedAtBlock: 0,
    computedAtTs: nowTs,
  };
}

/** Count how many tasks a given agent provided for (per the event stream). */
export function settledTaskVolume(events: ScoreEvent[], agentId: AgentId): bigint {
  let total = 0n;
  for (const ev of events) {
    if (ev.kind === "task_settled" && ev.providerAgentId === agentId) total += BigInt(ev.amountWei);
  }
  return total;
}
