# Scoring Engine

`score(agent) ∈ [0, 1000]` is a **pure function of the normalized onchain event stream**.
Same events + same `nowTs` ⇒ same score, on every machine. No admin key, no offchain opinions, no LLM judgment.

Implementation: [`packages/core/src/scorer.ts`](../packages/core/src/scorer.ts).  
Harness: `bun run recompute` (raw logs → pure scorer → diff vs API).

---

## Components & weights

| Component | Weight | What feeds it |
|---|---|---|
| **Reliability** | 300 | volume-weighted `settled / (settled + disputed + abandoned)` |
| **Activity depth** | 250 | log-scaled settled count + transacted volume |
| **Stake** | 200 | log-scaled stake·days (MON) actively staked |
| **Peer attestations** | 150 | P1 (bonded reviews) — **reserved, 0 in P0** |
| **Tenure & recency** | 100 | identity age + activity within last 7d |
| **Slash events** | −150 each | floored at 0 total |

Scale constants (from scorer):

| Constant | Value | Meaning |
|---|---|---|
| `activityTasks` | 50 | settled tasks for full activity score |
| `activityVolume` | 1000 | whole units transacted for full activity |
| `stakeMonDays` | 3000 | MON·days for full stake score |
| `tenureDays` | 30 | identity age for full tenure |
| `recencyWindow` | 7 | days for “recent activity” |
| `coldStartCap` | 190 | max score while unproven |
| `coldStartSettled` | 3 | settled tasks to lift cold-start |
| `coldStartStakeDays` | 30 | alternate path to lift cold-start |

---

## Cold start

A **fresh agent caps at 190** until it has **3 settled tasks** *or* **30 days of stake history**.

Unproven ≠ trusted — same reason a first credit card has a low limit. Sybil “good scores” require real settled volume and real stake.

---

## Event → outcome mapping

Normalized `ScoreEvent.kind` values consumed by the scorer (from EscrowHub / StakeVault / AgentRegistry):

| Kind | Effect |
|---|---|
| `registered` | sets DID, `registeredAt`, starts tenure |
| `staked` / `unstaked` / `unstake_initiated` | stake ledger (ts-ordered deltas) |
| `task_created` | open/neutral (no reliability weight yet) |
| `task_accepted` | pending |
| `task_delivered` | pending |
| `task_settled` | +settled count + volume (provider) |
| `task_disputed` | +disputed count |
| `task_refunded` / `task_abandoned` / timeout | +abandoned |
| `slashed` | slashCount++, penalty −150 each |
| `attested` | P1 reserved |

Reliability uses **volume-weighted** outcomes so large escrows move the ratio more than dust tasks.

---

## Determinism guarantees

1. Events sorted by `(block, logIndex)` before fold.
2. Timestamps come from **block timestamps** (not wall clock of the API host).
3. Scorer is stateless: input = event list + `nowTs`; output = `ScoreMap`.
4. Indexer only **caches** results per block; recompute ignores the cache.

### Verify yourself

```bash
# rebuild pure scorer + API and compare
bun run recompute

# core unit tests (scorer + indexer)
bun run test

# contract-level event emission
cd contracts && forge test
```

---

## ScoreBreakdown shape (API + SDK)

```ts
interface ScoreBreakdown {
  agentId: string;
  did: string;
  score: number; // rounded, clamped [0, 1000]
  components: {
    reliability: number;
    activity: number;
    stake: number;
    attestations: number;
    slashPenalty: number; // negative or 0
    tenure: number;
  };
  coldStart: boolean;
  coldStartCap: 190;
  stats: {
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
  };
  computedAtBlock: number;
  computedAtTs: number;
}
```

---

## Design tradeoff (honest)

**Onchain:** identity, stake, escrow transitions, slashes — tamper-evident history.  
**Offchain but deterministic:** the score fold — recomputable by anyone from public logs.

Why not score onchain? O(history) storage writes per update for a formula whose *inputs are already onchain*. Trust upgrade path (P1): signed score snapshots onchain (`ScoreSnapshotOracle` in architecture roadmap).
