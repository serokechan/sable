# Sable — The Agent Credit Bureau on Monad

**Hackathon:** Monad Metropolis (Track 4: Trust, Identity & AI Infrastructure)
**Team:** zuba, ado, Hermes (build agent)
**Deadline:** 13 Oct 2026 · **Doc version:** 0.1

---

## 1. One-liner

> **Sable is the onchain credit bureau for AI agents: ERC-8004 identity + deterministic reputation scoring + stake-slash accountability, so autonomous agents can finally decide — in one call — whether the agent on the other side is worth trusting with money.**

---

## 2. Problem

Agent commerce is arriving faster than agent trust. x402 and the Machine Payments Protocol make any HTTP endpoint payable in seconds; Monad's 600ms finality makes settlement instant. But when Agent A wants to pay Agent B to do a job, A has no way to answer the only question that matters:

**"Will this agent actually deliver?"**

Today's answers are all broken:

| Option | Why it fails |
|---|---|
| Offchain reputation APIs (scraper scores, "trust badges") | Not verifiable, not portable, one company's opinion |
| Web-of-trust / Twitter clout | Sybil-friendly, no skin in the game |
| Escrow-only flows | Protects the money, not the decision — doesn't stop you from wasting a task slot on a bad agent |
| Centralized marketplaces (closed platforms) | Walled gardens; the agent's record dies with the platform |

The missing primitive is what banks solved for humans 100 years ago: a **credit bureau** — shared, neutral, history-based, with consequences (stake gets slashed). Nobody has built it onchain where it is tamper-evident, portable across every marketplace, and computable by anyone.

## 3. Why now / why Monad

1. **ERC-8004 (2025) made agent identity a standard** — every agent gets a portable DID. Identity exists; reputation doesn't yet.
2. **x402 + MPP landed on Monad mainnet** (Monad's own x402 Facilitator is live, USDC-native). The payment rails for agent-to-agent commerce exist today on this exact chain.
3. **Monad is the only EVM chain where this loop feels instant:** 300ms blocks, 600ms finality, 10,000 TPS, full EVM bytecode + Ethereum RPC compatibility. Escrow → delivery → release → score update in the same conversation turn.
4. **Metropolis Track 4 explicitly asks for it:** "Agent identity and reputation under ERC-8004." We are building the reference implementation — on a chain that doesn't have one yet.

**Positioning:** ERC-8004's current flagship implementation lives on XLayer (OKX). Sable ships a Monad-native implementation of the identity + reputation surface, wired into the native agentic-payments stack. First mover on the chain running the hackathon.

## 4. Target users

1. **Agent builders / operators** (primary) — want their agent to get hired more (higher score = more jobs, better rates).
2. **Agent hirers** (buyers, marketplaces, protocol designers) — want a one-call trust check before escrowing funds.
3. **Agentic payment platforms** — want a neutral scoring layer instead of building their own (embeddable via SDK).

## 5. The core loop (product in one picture)

```
                 ┌──────────────────────────────────────────────┐
                 │                AGENT LIFECYCLE               │
                 └──────────────────────────────────────────────┘
 register ──► stake (skin in the game) ──► transact (x402 / escrow)
    │                │                              │
 ERC-8004       StakeVault                EscrowHub / x402 payment
 identity            │                              │
    │                │        ┌─────────────────────┴────────────┐
    │                │        ▼                                    ▼
    │            slashed ◄── dispute/rug      completed & accepted
    │                │                                    │
    └───────► every event feeds the SCORING ENGINE (deterministic)
                          │
                          ▼
              SCORE (0–1000) — public, recomputable by anyone
                          │
                          ▼
              SDK trust-check: "hire only agents ≥ 500"
```

Honest work compounds into reputation; rugging costs stake and score. The score is the product.

## 6. Feature set

### MVP (must ship for judging) — P0
- **AgentRegistry** — ERC-8004-style onchain identity: DID, metadata URI, payment endpoint, owner wallet.
- **StakeVault** — stake MON/USDC; slashing path with evidence hash; unstake cooldown.
- **EscrowHub** — task escrow (create / deliver / accept / dispute / refund / timeout) emitting score-relevant events; x402-settleable via the Monad facilitator.
- **Scoring Engine (indexer)** — deterministic score 0–1000 computed purely from onchain events; API `GET /agents/:did/score`.
- **SDK** — `@sable/sdk`: score check, stake, escrow, plus **policy middleware** (auto-refuse payments to agents below a minScore).
- **Dashboard** — agent profile pages (score breakdown, history, attestations), leaderboard, live event feed, demo stage.

### v1.5 (nice, differentiating) — P1
- **Bonded attestations** — counterparties of settled escrows can leave signed ratings (anti-Sybil: only real transactions can generate reviews).
- **Score watch / webhooks** — subscribe to score changes (marketplaces can auto-delist).
- **MonadVision deep links** — every score input is one click from its proof on the explorer.

### Stretch (post-hackathon) — P2
- Passkey (P256/WebAuthn) agent account management — natural extension, listed in roadmap only.
- Cross-marketplace attestation imports; evaluator/arbiter marketplace roles.

### Non-goals (explicitly out of scope)
- Human credit scoring. Agents only.
- Subjective/AI-judged scores — every input to the score MUST be an onchain event; no offchain opinions, no LLM scoring (determinism is the moat).
- Our own general marketplace — we score, others hire.

## 7. Scoring model (deterministic, auditable)

`score(agent) ∈ [0, 1000]`, pure function of onchain state. Anyone can recompute it and get the same number — this is the differentiator vs every offchain "agent trust API."

| Component | Weight | Formula sketch |
|---|---|---|
| **Reliability** | 300 | `accepted / (accepted + disputes + abandoned)`, volume-weighted |
| **Activity depth** | 250 | log-scaled count of settled tasks + volume transacted |
| **Stake (skin in the game)** | 200 | log-scaled MON·days actively staked |
| **Peer attestations** | 150 | decayed, counterpart-weighted (P1) |
| **Tenure & recency** | 100 | identity age + recent activity window |
| **Slash events** | −150 each | floored at 0 |

**Cold-start rule:** fresh agents cap at **190** until 3 settled tasks or 30 days of stake. New agents are *unproven*, not trusted by default — the same reason your first credit card has a $500 limit. This makes Sybil attacks structurally unprofitable: faking a good score costs real stake and real settled volume.

## 8. The 90-second demo (the "wow")

**Stage:** live on Monad testnet (fallback: forked mainnet), demo agents are real Hermes-run bots with real wallets.

1. **Atlas** (buyer, score 720) posts a task: "summarize these 10 PDFs — 5 USDC."
2. **Nova** (provider, score 645) applies. UI shows her score card — reliability 96%, 42 settled tasks, 300 MON staked. Atlas's policy is `minScore 500` → **auto-approved**.
3. Escrow funds in **< 2 seconds** (block explorer link on screen).
4. Nova delivers → hash onchain → Atlas verifies → release → **Nova's score ticks up +3 on the live leaderboard** — the whole room watches the number move within seconds of the tx.
5. Plot twist: **Rex** (score 180, slashed twice) applies → policy engine **rejects him live**, red banner: *"2 slash events · below trust threshold"*. Rex must stake to bootstrap. Trust has a price, and now you can watch it being paid.

## 9. Judging criteria alignment

- **"Working product"**: live testnet deployment + real bot-to-bot payments, not a mock.
- **"Demo, write-up, code link"**: this PRD + ARCHITECTURE.md + open repo (contracts verified on MonadVision).
- **Track fit**: we are the ERC-8004 reputation primitive the track names.
- **Monad-native**: uses Monad x402 facilitator, 600ms finality as a UX feature (score moves in-conversation), EVM-compatible Solidity.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| x402 integration complexity eats time | EscrowHub works standalone; x402 wiring is P1-separable, not load-bearing |
| Score computed offchain → "is it really trustless?" | Deterministic + open-source scorer; publish state proofs; (stretch) onchain score snapshot oracle |
| Sybil feedback loops | Cold-start cap + stake requirement + bonded attestations only from settled escrows |
| 4.5 weeks, small team | Scope above is cut to P0 only; demo agents reuse existing Hermes multi-agent infra |
| Mainnet deployment surprises (gas, verifier) | Deploy contracts to testnet W1 and mainnet W4 only for final filming; keep both explorable |

## 11. Success definition

- A stranger can, in one API call, decide whether to trust an arbitrary agent with money — and every number in that call is verifiable on Monad.
- Judges can reproduce our entire demo from the repo in < 10 minutes.
