/**
 * Normalized score-relevant event stream.
 *
 * These types are the ONLY input to the scorer. Every field originates from a
 * public chain event — no offchain opinions, no admin feeds, ever.
 */

export type AgentId = string; // decimal string of the onchain uint256 agentId

export interface AgentRegisteredEvent {
  kind: "registered";
  agentId: AgentId;
  owner: string;
  did: string;
  ts: number;
  block: number;
}
export interface AgentStatusEvent {
  kind: "agent_status";
  agentId: AgentId;
  active: boolean;
  ts: number;
  block: number;
}
export interface StakedEvent {
  kind: "staked";
  agentId: AgentId;
  amountWei: string;
  ts: number;
  block: number;
}
export interface UnstakedEvent {
  kind: "unstaked";
  agentId: AgentId;
  amountWei: string;
  ts: number;
  block: number;
}
export interface SlashedEvent {
  kind: "slashed";
  agentId: AgentId;
  amountWei: string;
  evidenceHash: string;
  ts: number;
  block: number;
}
export interface TaskCreatedEvent {
  kind: "task_created";
  taskId: string;
  hirerAgentId: AgentId;
  providerAgentId: AgentId;
  amountWei: string;
  ts: number;
  block: number;
}
export interface TaskSettledEvent {
  kind: "task_settled";
  taskId: string;
  providerAgentId: AgentId;
  amountWei: string;
  ts: number;
  block: number;
}
export interface TaskDisputedEvent {
  kind: "task_disputed";
  taskId: string;
  providerAgentId: AgentId;
  ts: number;
  block: number;
}
export interface TaskRefundedEvent {
  kind: "task_refunded";
  taskId: string;
  providerAgentId: AgentId;
  /** true = refund after the provider had accepted/delivered (counts as a dispute loss) */
  afterAccept: boolean;
  ts: number;
  block: number;
}
export interface TaskTimedOutEvent {
  kind: "task_timed_out";
  taskId: string;
  providerAgentId: AgentId;
  /** true = timed out after acceptance (counts as abandoned) */
  afterAccept: boolean;
  ts: number;
  block: number;
}

export type ScoreEvent =
  | AgentRegisteredEvent
  | AgentStatusEvent
  | StakedEvent
  | UnstakedEvent
  | SlashedEvent
  | TaskCreatedEvent
  | TaskSettledEvent
  | TaskDisputedEvent
  | TaskRefundedEvent
  | TaskTimedOutEvent;

export const SCORE_EVENT_KINDS = [
  "registered",
  "agent_status",
  "staked",
  "unstaked",
  "slashed",
  "task_created",
  "task_settled",
  "task_disputed",
  "task_refunded",
  "task_timed_out",
] as const;

export interface ScoreStats {
  settledTasks: number;
  disputedTasks: number;
  abandonedTasks: number;
  openDisputes: number;
  volumeWei: string;
  stakeWei: string;
  monDays: number;
  tenureDays: number;
  recentActivity: boolean;
  slashCount: number;
}

export interface ScoreBreakdown {
  agentId: AgentId;
  did: string | null;
  score: number; // 0–1000
  components: {
    reliability: number; // max 300
    activity: number; // max 250
    stake: number; // max 200
    attestations: number; // max 150 (P1 — reserved, 0 in P0)
    tenure: number; // max 100
    slashPenalty: number; // -150 per slash event
  };
  coldStart: boolean;
  coldStartCap: number;
  stats: ScoreStats;
  computedAtBlock: number;
  computedAtTs: number;
}

export type ScoreMap = Record<AgentId, ScoreBreakdown>;
