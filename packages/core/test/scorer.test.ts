import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeScores, SCORING_SCALE, SCORING_WEIGHTS, settledTaskVolume } from "../src/scorer.js";
import type { ScoreEvent } from "../src/types.js";

const DAY = 86_400;

describe("Sable Scorer (Pure Deterministic Engine)", () => {
  it("empty events stream returns empty score map", () => {
    const scores = computeScores([], 1000);
    assert.deepEqual(scores, {});
  });

  it("enforces cold-start cap for unproven agent", () => {
    const t0 = 1_000_000;
    const events: ScoreEvent[] = [
      { kind: "registered", agentId: "1", did: "did:agent:newbie", owner: "0x1", ts: t0, block: 1 },
      // 1 task settled (less than coldStartSettled = 3)
      { kind: "task_created", taskId: "1", hirerAgentId: "99", providerAgentId: "1", amountWei: "1000000000000000000", ts: t0 + 10, block: 2 },
      { kind: "task_settled", taskId: "1", providerAgentId: "1", amountWei: "1000000000000000000", ts: t0 + 20, block: 3 },
    ];

    const scores = computeScores(events, t0 + DAY);
    const s = scores["1"];
    assert.ok(s);
    assert.equal(s.coldStart, true);
    assert.ok(s.score <= SCORING_SCALE.coldStartCap);
    assert.equal(s.did, "did:agent:newbie");
    assert.equal(s.stats.settledTasks, 1);
  });

  it("lifts cold-start cap once threshold of settled tasks is reached", () => {
    const t0 = 1_000_000;
    const events: ScoreEvent[] = [
      { kind: "registered", agentId: "2", did: "did:agent:veteran", owner: "0x2", ts: t0, block: 1 },
      { kind: "staked", agentId: "2", amountWei: (300n * 10n ** 18n).toString(), ts: t0 + 10, block: 2 },
    ];

    // Settle 3 tasks (>= coldStartSettled)
    for (let i = 1; i <= 3; i++) {
      events.push(
        { kind: "task_created", taskId: String(i), hirerAgentId: "99", providerAgentId: "2", amountWei: "5000000000000000000", ts: t0 + i * 100, block: 10 + i },
        { kind: "task_settled", taskId: String(i), providerAgentId: "2", amountWei: "5000000000000000000", ts: t0 + i * 100 + 50, block: 20 + i },
      );
    }

    // Reference time 35 days later
    const nowTs = t0 + 35 * DAY;
    const scores = computeScores(events, nowTs);
    const s = scores["2"];
    assert.ok(s);
    assert.equal(s.coldStart, false);
    assert.ok(s.score > SCORING_SCALE.coldStartCap, `Score ${s.score} should exceed cold start cap`);
  });

  it("calculates volume-weighted reliability accurately", () => {
    const t0 = 1_000_000;
    const events: ScoreEvent[] = [
      { kind: "registered", agentId: "3", did: "did:agent:tested", owner: "0x3", ts: t0, block: 1 },
      // 1 settled task of 10 ETH
      { kind: "task_created", taskId: "1", hirerAgentId: "99", providerAgentId: "3", amountWei: (10n * 10n ** 18n).toString(), ts: t0 + 10, block: 2 },
      { kind: "task_settled", taskId: "1", providerAgentId: "3", amountWei: (10n * 10n ** 18n).toString(), ts: t0 + 20, block: 3 },
      // 1 disputed task of 10 ETH (after acceptance)
      { kind: "task_created", taskId: "2", hirerAgentId: "99", providerAgentId: "3", amountWei: (10n * 10n ** 18n).toString(), ts: t0 + 30, block: 4 },
      { kind: "task_refunded", taskId: "2", providerAgentId: "3", afterAccept: true, ts: t0 + 40, block: 5 },
    ];

    const scores = computeScores(events, t0 + 100);
    const s = scores["3"];
    assert.ok(s);
    // 10 ETH good, 10 ETH bad => 50% reliability
    // Expected reliability component = 50% * 300 = 150
    assert.equal(s.components.reliability, 150);
  });

  it("neutral pre-acceptance refunds do not penalize reliability", () => {
    const t0 = 1_000_000;
    const events: ScoreEvent[] = [
      { kind: "registered", agentId: "4", did: "did:agent:clean", owner: "0x4", ts: t0, block: 1 },
      // 1 settled task of 5 ETH
      { kind: "task_created", taskId: "1", hirerAgentId: "99", providerAgentId: "4", amountWei: (5n * 10n ** 18n).toString(), ts: t0 + 10, block: 2 },
      { kind: "task_settled", taskId: "1", providerAgentId: "4", amountWei: (5n * 10n ** 18n).toString(), ts: t0 + 20, block: 3 },
      // 1 cancelled task before acceptance (afterAccept = false)
      { kind: "task_created", taskId: "2", hirerAgentId: "99", providerAgentId: "4", amountWei: (5n * 10n ** 18n).toString(), ts: t0 + 30, block: 4 },
      { kind: "task_refunded", taskId: "2", providerAgentId: "4", afterAccept: false, ts: t0 + 40, block: 5 },
    ];

    const scores = computeScores(events, t0 + 100);
    const s = scores["4"];
    assert.ok(s);
    // Reliability must remain 100% (300 pts)
    assert.equal(s.components.reliability, 300);
    assert.equal(s.stats.disputedTasks, 0);
  });

  it("integrates stake ledger into MON·days with unstake delta", () => {
    const t0 = 1_000_000;
    const tenEth = (10n * 10n ** 18n).toString();
    const events: ScoreEvent[] = [
      { kind: "registered", agentId: "5", did: "did:agent:staker", owner: "0x5", ts: t0, block: 1 },
      // Stake 10 MON at t0
      { kind: "staked", agentId: "5", amountWei: tenEth, ts: t0, block: 2 },
      // Unstake 10 MON at t0 + 10 days
      { kind: "unstaked", agentId: "5", amountWei: tenEth, ts: t0 + 10 * DAY, block: 3 },
    ];

    // Reference time at t0 + 20 days: balance has been 0 for the last 10 days
    const scores = computeScores(events, t0 + 20 * DAY);
    const s = scores["5"];
    assert.ok(s);
    // 10 MON held for exactly 10 days = 100 MON·days
    assert.equal(s.stats.monDays, 100);
    assert.equal(s.stats.stakeWei, "0");
  });

  it("applies slash penalty and floors score at 0", () => {
    const t0 = 1_000_000;
    const events: ScoreEvent[] = [
      { kind: "registered", agentId: "6", did: "did:agent:slashed", owner: "0x6", ts: t0, block: 1 },
      // Slashed twice = -300 pts penalty
      { kind: "slashed", agentId: "6", amountWei: "1000", evidenceHash: "0xabc", ts: t0 + 10, block: 2 },
      { kind: "slashed", agentId: "6", amountWei: "1000", evidenceHash: "0xdef", ts: t0 + 20, block: 3 },
    ];

    const scores = computeScores(events, t0 + 100);
    const s = scores["6"];
    assert.ok(s);
    assert.equal(s.stats.slashCount, 2);
    assert.equal(s.components.slashPenalty, -300);
    // Score must be floored at 0, never negative
    assert.equal(s.score, 0);
  });

  it("is strictly deterministic: identical inputs yield identical output", () => {
    const t0 = 1_000_000;
    const events: ScoreEvent[] = [
      { kind: "registered", agentId: "7", did: "did:agent:det", owner: "0x7", ts: t0, block: 1 },
      { kind: "staked", agentId: "7", amountWei: (50n * 10n ** 18n).toString(), ts: t0 + 5, block: 2 },
      { kind: "task_created", taskId: "1", hirerAgentId: "99", providerAgentId: "7", amountWei: (5n * 10n ** 18n).toString(), ts: t0 + 10, block: 3 },
      { kind: "task_settled", taskId: "1", providerAgentId: "7", amountWei: (5n * 10n ** 18n).toString(), ts: t0 + 20, block: 4 },
    ];

    const run1 = computeScores(events, t0 + 5 * DAY);
    const run2 = computeScores(events, t0 + 5 * DAY);
    assert.deepEqual(run1, run2);
  });

  it("calculates settledTaskVolume correctly", () => {
    const events: ScoreEvent[] = [
      { kind: "task_settled", taskId: "1", providerAgentId: "8", amountWei: "500", ts: 10, block: 1 },
      { kind: "task_settled", taskId: "2", providerAgentId: "8", amountWei: "1500", ts: 20, block: 2 },
      { kind: "task_settled", taskId: "3", providerAgentId: "9", amountWei: "9999", ts: 30, block: 3 },
    ];
    assert.equal(settledTaskVolume(events, "8"), 2000n);
    assert.equal(settledTaskVolume(events, "9"), 9999n);
    assert.equal(settledTaskVolume(events, "10"), 0n);
  });
});
