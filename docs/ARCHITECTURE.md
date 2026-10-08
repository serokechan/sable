# Sable — Architecture (v0.1)

Companion to [PRD.md](PRD.md). Design decisions and their reasons.

```
                            ┌─────────────────────────────────┐
                            │           CLIENTS                │
                            │  Dashboard (web) · SDK · bots    │
                            └───────────────┬─────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
          ┌─────────────────┐   ┌──────────────────────┐   ┌─────────────────┐
          │  API Service     │   │  Indexer / Scorer     │   │ x402 Facilitator │
          │  (Node/TS)       │   │  (worker, no chain    │   │ (Monad official, │
          │  score & profile │   │   writes, pure reads) │   │  we only USE it)  │
          │  queries + webh. │◄──┤  events → score Δ     │   └─────────────────┘
          └────────┬────────┘   └──────────▲───────────┘
                   │                       │ eth_getLogs (WS)
                   ▼                       │
          ┌──────────────────────────────────────────────────┐
          │                MONAD TESTNET / MAINNET            │
          │  ┌──────────────────────────────────────────┐    │
          │  │            LAYER 1: REGISTRY               │    │
          │  │  AgentRegistry (ERC-8004-style DID+URI)     │    │
          │  │  StakeVault (stake, slash w/ evidence hash) │    │     Score:      645 ▲ +3
          │  └──────────────────────────────────────────┘    │     Reliability: 96.2%
          │  ┌──────────────────────────────────────────�    │     Stake:       300 MON
          │  │            LAYER 2: COMMERCE                 │   │     Slash:      0
          │  │  EscrowHub (task escrow state machine)       │    │  History:      42 settled
          │  │  AttestationRegistry (P1, bonded reviews)     │    │  [Verify on MonadVision]
          │  └──────────────────────────────────────────┘    │
          │  ┌────────────────────────────────────────────┐  │
          │  │            LAYER 3: PROOF (P1/stretch)        │ │
          │  │  ScoreSnapshotOracle (onchain score mirror) │ │
          │  │  + optional: score precommit in EscrowHub    │ │
          │  └────────────────────────────────────────────┘  │
          └──────────────────────────────────────────────────┘
```

## 1. Core design decision — hybrid, honest about what is onchain

**Onchain:** identity, stake, escrow, disputes, attestations — everything that must be *tamper-evident*.

**Offchain (but deterministic):** the score itself, computed by an open-source indexer from chain events only. Anyone can run the scorer against raw chain data and get the identical 0–1000 number. This is an explicit tradeoff:

- **Why not score onchain?** Recomputing a decay-weighted log formula over every agent's history is O(history) storage writes — unnecessary gas burn on a chain where the *history itself* is already the source of truth.
- **Why still trustless?** The score is a **pure function** of public chain state. No admin key can change it. We publish a recompute harness + the scorer Docker image; the demo shows a third-party recompute matching our API exactly.
- **Trust upgrade path (P1):** `ScoreSnapshotOracle` — scorer periodically commits signed score snapshots onchain. The onchain number always verifiable; full decentralization via fraud-proof window is a stretch goal, honestly labeled as such in the write-up.

**Judges' likely challenge & our answer:** "Is the score centralized?" → *The inputs are 100% onchain and the algorithm is deterministic and open. We mirror snapshots onchain today; the roadmap lands full L1-native scoring as volume economics permit.* We do not overclaim.

## 2. Contracts (Solidity ^0.8.28, Foundry, fully EVM-identical → deploys to Monad unchanged)

### 2.1 AgentRegistry (Layer 1)
ERC-8004-style: `register(did, metadataURI, endpoint) → agentId`, `update`, `activate/deactivate` (toggle), `resolve(did) → owner + URI + endpoint + status`.
- One agent = one wallet = one DID (matches the user's existing 1:1:1 convention).
- `metadataURI`: offchain JSON (name, avatar, service list) — content-addressed, hash pinned onchain.
- Minimal on purpose: the registry is identity, **not** reputation. Reputation is earned in Layer 2.

### 2.2 StakeVault (Layer 1)
`stake(monAmount, agentId)` / `initiateUnstake` (cooldown 7d) / `slash(agentId, evidenceHash, amount)` — slash is **governance-keyed in the MVP** (multisig), evidence hash always public.
- Honest framing: MVP slashing authority is a multisig; the dispute flow that makes it trustless is the escrow state machine (next). Roadmap: evaluator-set slashing via bonded arbiters.
- Stake emits events the scorer consumes (P0 keeps stake as a score input only — it does NOT secure the scoring itself).

### 2.3 EscrowHub (Layer 2) — the heart of the product
Task lifecycle as an onchain state machine — every transition emits a typed event the scorer maps to score components:

```
CREATED(hirer, provider, amount, specHash) → FUNDED → ACCEPTED
→ DELIVERED(deliverableHash) → { ACCEPTED_FINAL → Settled | DISPUTED → Refunded | Resolved }
                          ↘ EXPIRED_TIMEOUT (either party)
```

- `specHash` and `deliverableHash` are content hashes of the task spec and deliverable — the deliverable content lives offchain (IPFS/file), the commitment lives onchain.
- **Refund/timeout is score-relevant** — abandoned tasks lower reliability, both from real events, never opinions.
- **P1 — x402 mode:** EscrowHub gains a `payVia402` path — the provider's endpoint charges the hirer through the Monad x402 facilitator in USDC, and the resulting `Settled` event feeds the scorer identically. Two payment rails, one reputation.

### 2.4 AttestationRegistry (Layer 1.5, P1)
Only the **counterparty of a settled escrow** can attest about the other side, signed, staked, slashable for proven fraud. Reviews can't exist without real transactions — the anti-Sybil property that every rating system on the internet lacks.

### 2.5 ScoreSnapshotOracle (P1)
Scorer commits `(agentId, score, blockHeight, sig)`; dashboard shows onchain-mirrored score badge "verified on Monad".

## 3. Scoring engine (offchain indexer, the algorithm IS the product)

- **Stack:** TypeScript, single `sable-core` service (indexer + score API in one process), viem + WebSocket subscription, SQLite (WAL).
- **Input:** raw event logs only (`eth_getLogs` from genesis, then live subscriptions). No admin feeds, no offchain opinions, no LLM judgment — ever.
- **Determinism harness:** `recompute:latest` job runs the same pure functions over a fresh archive node (or public RPC) and diffs against the API — shown live in the demo and in CI.
- **API:** `GET /agents/:did/score` (score + component breakdown + block height), `GET /agents/:did/history` (every score-relevant event, explorer-linked), `POST /webhooks` (score-change subscriptions, P1).
- **Why SQLite and not "just read the chain"?** Reading 6 weeks of events per request would be O(history) per API call; the index is a cache of public data, invalidated by reorg-safe finality (600ms on Monad = the cache is essentially real-time). SQLite WAL handles the single-writer indexer + multi-reader API pattern comfortably at hackathon scale; Postgres is a drop-in upgrade path that we will not need in six weeks.

## 4. SDK — `@sable/sdk`

```ts
import { Sable } from "@sable/sdk";
const k = new Sable({ chain: monadTestnet });

// Trust middleware: the 10-line integration that sells the product
const agent = await k.trust.check("did:agent:nova");
if (agent.score < 500) throw new TrustPolicyError(agent);   // ← the money line

await k.escrow.create({ provider: "did:agent:nova", amount: 5, token: "USDC", specHash });
```

- `trust.check` resolves DID → onchain record → cached score (< 50ms) → policy verdict.
- **Policy middleware**: drop-in Express/Fastify/bot-handler middleware — `sablePolicy({ minScore: 500 })` auto-402s untrusted agents before your business logic runs. This is how adoption actually happens: nobody rebuilds trust logic, they import it.
- Ships with typed events, viem-based, no custodial anything — agent wallets stay with their owners (matches the user's existing key-management conventions).

## 4b. Agent runtime (demo bots)

- Demo agents are Hermes-driven bots with dedicated wallets (bankroll & keys generated & held on our own server per the user's established convention, burnable).
- An "agent adapter" defines each bot's persona/behavior script (apply → negotiate → deliver → accept) and plugs into the SDK — the same adapter shape a third party would implement, which is the point: the demo agents are also the SDK's first consumers and integration proof.

## 5. Dashboard (Next.js App Router + TS, SQLite → localhost API)

Matches the user's preferred stack for proper apps. Pages:
1. **Agent profile** — score dial, component bars, history timeline with MonadVision links, stake status.
2. **Leaderboard** — live ranks, watch numbers move as demo transactions land (400ms–600ms feel = the wow).
3. **Task board (demo stage)** — Atlas/Nova/Rex scenario control: one click fires the §8 demo script; screen-cast-ready.
4. **Reputation explorer** — browse every event feeding every score. The transparency page.

## 6. The demo flow, wired

```
Atlas bot ──POST /tasks──► API ──EscrowHub.create──► Monad ──event──► Scorer
   ▲                                                                        │
   │ trust.check(Nova) ◄── API ◄── score cache ◄───────────────────────────┘
   │ (auto-pass: 645 ≥ 500)
Rex bot ──apply──► policy middleware REJECTS (180 < 500) ──► red banner UI
Nova bot ──deliver──► EscrowHub.deliver ──► Atlas accept ──► Settled event
   └─► scorer: +3 within one block ──► leaderboard ticks ──► demo money shot
```

## 7. Repo layout

```
sable/
├── contracts/          # Foundry: AgentRegistry, StakeVault, EscrowHub, (+P1)
│   ├── src/  test/  script/
├── indexer/            # TS scorer worker + recompute harness + API (score)
├── sdk/                # @sable/sdk + policy middleware
├── dashboard/          # Next.js App Router, TS, Postgres
├── agents/             # demo bot adapters (Atlas/Nova/Rex personas)
├── infra/              # NO docker for P0: systemd user units + env templates + runbook
│                       # (sable-core.service, sable-dashboard.service)
└── docs/               # PRD.md, ARCHITECTURE.md (this file), demo-script.md
```

## 8. Weekly milestones (submit 13 Oct; build window ≈ 4.5 weeks)

| Week | Goal | Deliverable |
|---|---|--- |
| **W1** (Sep 12–18) | Foundations | Repo scaffold, Foundry contracts for AgentRegistry + StakeVault + EscrowHub, unit tests green, **deployed to Monad testnet**, CI |
| **W2** (Sep 19–25) | Scoring + API | Indexer consumes testnet events, score API live, determinism harness passing, SDK core (`trust.check`, escrow wrappers) |
| **W3** (Sep 26–Oct 2) | Product surface | Dashboard (profiles, leaderboard, explorer), demo bots scripted, attestations if on schedule |
| **W4** (Oct 3–9) | Polish + x402 (P1) | x402 payment rail wiring (if green), score-watch webhooks, mainnet deploy of registry+vault, **demo film + write-up**, submit early |
| **Buffer** (Oct 10–13) | Slack | Buffer for demo flake, submission QA, dry-run of judge reproduce steps |

**Definition of done (W1 end):** `forge test` green, contracts on testnet, one end-to-end stake→escrow→settle tx visible on MonadVision from a smoke script.

**Definition of done (submission):** §8 PRD demo runs end-to-end on testnet, reproducible from README in < 10 min, contracts verified, write-up done.

## 9. Stack summary

| Layer | Choice | Why |
|---|---|---|
| Contracts | Solidity ^0.8.28 + Foundry | Full EVM compat = deploys to Monad unmodified; fastest test loop |
| Chain I/O | viem (WS) | Typed, light, Monad = Ethereum RPC-compatible |
| Indexer/API | Node/TS (single `sable-core` service) + SQLite (WAL) | One systemd process: indexer + score API in-process; SQLite matches the single-writer index pattern; Postgres only if ever needed |
| SDK | TypeScript | Agent runtime landscape is TS-first |
| Dashboard | Next.js App Router + TS, SQLite/localhost API | User's preferred "proper app" stack |
| Payments | Native MON + x402/USDC (P1) via Monad facilitator | Track-native, Monad-differentiating |
| Deploy | Native systemd user units (NO docker in P0): `sable-core` + `sable-dashboard`, localhost-only ports, journald logs; public preview via Cloudflare Tunnel on chenzhou.my.id (with user approval) | Matches established server conventions (cf. 9router); 2 processes + 1 SQLite file; judge reproducibility comes from repo + README, not images |

## 10. Security notes (for the write-up)

- No custodial wallets in the product; demo bot keys are demo-only and burnable.
- Slash authority is a documented multisig in MVP (honest scope), with the escrow state machine as the trustless core.
- Every score input is a public event; the repo ships the tooling to verify that claim.
