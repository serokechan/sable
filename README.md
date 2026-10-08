# Sable — The Agent Credit Bureau

ERC-8004 identity + deterministic reputation scoring + stake-slash accountability.
One-call trust check for agent-to-agent commerce.

**Docs index:** [docs/README.md](docs/README.md) · [PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Scoring](docs/SCORING.md) · [SDK](docs/SDK.md) · [Deployment](docs/DEPLOYMENT.md) · [Development](docs/DEVELOPMENT.md) · [Operations](docs/OPERATIONS.md)

**Status:** P0 shipped. Deployed and seeded on **Monad testnet (chainId 10143)**. Local Anvil stack still supported for offline dev.

---

## Quickstart

### Prerequisites

- Node 24+ / [Bun](https://bun.sh) 1.1+
- [Foundry](https://getfoundry.sh) (`foundryup`) for contracts
- Optional (testnet): funded deployer key on [Monad faucet](https://faucet.monad.xyz/)

### Local (Anvil)

```bash
bun install
bun run chain        # terminal 1 — anvil 127.0.0.1:8545
bun run deploy       # terminal 2 — deploy contracts → deployments/31337.json
bun run seed         # Atlas / Nova / Rex + escrow history
bun run dev          # app on http://127.0.0.1:3000
```

### Monad testnet (production-like)

```bash
# one-time: put deployer PK in contracts/.env (see docs/DEPLOYMENT.md)
bun run deploy:monad
bun run seed:monad
bun run dev:monad    # or restart app with app/.env.local already set
```

Open **http://127.0.0.1:3000** — landing, dashboard, leaderboard, explorer, demo stage.

Verify health:

```bash
curl -s http://127.0.0.1:3000/api/health
# {"ok":true,"chainId":10143,"agents":3,"events":32,...}
```

---

## What you get

| Surface | URL | Purpose |
|---|---|---|
| Landing | `/` | Product overview |
| Dashboard | `/dashboard` | KPIs, score trends, live events |
| Leaderboard | `/leaderboard` | Ranked scores + breakdowns |
| Explorer | `/explorer` | Raw onchain event feed |
| Agent profile | `/agents/:did` | Score dial, components, history |
| Demo stage | `/demo` | One-click escrow lifecycle |

**Scoring** is a pure function of onchain events (`score ∈ [0, 1000]`). Anyone can recompute from raw logs — see [docs/SCORING.md](docs/SCORING.md).

---

## API (summary)

| Endpoint | What |
|---|---|
| `GET /api/health` | chainId, addresses, agent/event counts |
| `GET /api/agents` | leaderboard |
| `GET /api/agents/:did` | profile + breakdown + history |
| `GET /api/agents/:did/score` | one-call trust score |
| `GET /api/agents/:did/history` | score-relevant events |
| `GET /api/events` | raw event feed |
| `GET/POST /api/demo` | demo stage state / actions |

Full reference: [docs/API.md](docs/API.md).

---

## Repo layout

```
contracts/           Foundry: AgentRegistry · StakeVault · EscrowHub
  deployments/       <chainId>.json (31337 local, 10143 Monad testnet)
  testnet-bots.json  fresh demo keys for public chains (gitignored)
packages/core        @sable/core   scorer · indexer · SQLite · viem I/O
packages/sdk         @sable/sdk    trust.check · escrow · policy
packages/agents      @sable/agents demo bots (Atlas / Nova / Rex)
app/                 Next.js App Router: dashboard + API + instrumentation indexer
scripts/             deploy · seed · recompute · smoke
docs/                PRD · architecture · ops runbooks
```

---

## Scripts

| Script | Command |
|---|---|
| Local chain | `bun run chain` |
| Build packages | `bun run build:libs` |
| Deploy local | `bun run deploy` |
| Seed local | `bun run seed` |
| Dev (local) | `bun run dev` |
| Deploy Monad testnet | `bun run deploy:monad` |
| Seed Monad testnet | `bun run seed:monad` |
| Dev (Monad testnet) | `bun run dev:monad` |
| Recompute scores | `bun run recompute` |
| Smoke checks | `bun run smoke` |
| Core tests | `bun run test` |
| Contract tests | `cd contracts && forge test` |

---

## Configuration

Read by app + indexer (`app` loads `.env.local` automatically):

| Env | Default | Notes |
|---|---|---|
| `SABLE_RPC_URL` | `http://127.0.0.1:8545` | Monad: `https://testnet-rpc.monad.xyz` |
| `SABLE_CHAIN_ID` | `31337` | Monad testnet: `10143` |
| `SABLE_DB_PATH` | `.data/sable.db` | SQLite WAL index |
| `SABLE_START_BLOCK` | genesis | First block with contract code (testnet) |
| `SABLE_BOTS_FILE` | anvil mnemonic | Path to fresh bot keys on public chains |

Contract addresses resolve from `contracts/deployments/<chainId>.json`.

Secrets (never commit):

- root `.env` / `contracts/.env` → `DEPLOYER_PRIVATE_KEY`
- `contracts/testbot-bots.json` / `testnet-bots.json` → demo bot keys (gitignored)

---

## Monad testnet notes

- **RPC:** `https://testnet-rpc.monad.xyz` · **chainId:** `10143` · **faucet:** https://faucet.monad.xyz/
- **Reserve rule:** ~10 MON/EOA must remain undelegated. Gas-only txs OK; value transfers need free balance above reserve (or emptying rules — seed handles this).
- **`eth_getLogs` range:** max **100 blocks** per call — `packages/core` uses `CHUNK_SIZE = 100`.
- Do not fund or reuse **anvil mnemonic** addresses on public chains (they can be EIP-7702 delegated).

Full runbook: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## License

Private / hackathon — see repository owners.
# sable
