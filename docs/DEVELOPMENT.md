# Development Guide

Local workflow, package map, testing, and conventions.

---

## Stack

| Layer | Choice |
|---|---|
| Contracts | Solidity ^0.8.28 + Foundry |
| Chain I/O | viem |
| Scorer / indexer | TypeScript, SQLite (WAL) |
| SDK / bots | TypeScript (`@sable/sdk`, `@sable/agents`) |
| App | Next.js 15 App Router, React 19, Tailwind 4 |
| Package manager | Bun workspaces |

---

## Prerequisites

```bash
# Bun (workspace scripts)
curl -fsSL https://bun.sh/install | bash

# Foundry (contracts)
curl -L https://foundry.paradigm.xyz | bash && foundryup

node -v   # 24+ recommended
```

Install deps from repo root:

```bash
bun install
```

---

## Daily loop

```bash
# terminal 1 — chain (or skip if using testnet)
bun run chain

# terminal 2 — everything else as needed
bun run deploy && bun run seed
bun run dev
# → http://127.0.0.1:3000
```

After editing any file under `packages/*`:

```bash
bun run build:libs
```

App imports packages from `dist/` — rebuild required for core/sdk/agents changes.

---

## Workspace map

```
sable/                  # repo root (package name: sable)
├── packages/core          # @sable/core
│   ├── scorer.ts          # pure score fold
│   ├── indexer.ts         # startIndexer() — poll eth_getLogs → SQLite
│   ├── db.ts              # SQLite WAL helpers
│   ├── chain.ts           # viem client, ABIs, CHUNK_SIZE, loadLocalAddresses
│   └── bootstrap.ts       # optional local bootstrap helpers
├── packages/sdk           # @sable/sdk — Sable class, trust.check, escrow
├── packages/agents        # @sable/agents — DemoBot, createBots()
├── app                    # @sable/app — Next.js
│   ├── src/instrumentation.ts   # starts indexer in-process
│   ├── src/server/              # runtime, config, indexer helpers
│   └── src/app/                 # routes + API
├── contracts/             # Foundry project
│   ├── src/               # AgentRegistry, StakeVault, EscrowHub
│   ├── test/              # forge tests
│   ├── script/            # Deploy.s.sol
│   └── deployments/       # <chainId>.json
└── scripts/               # deploy, seed, recompute, smoke (tsx)
```

**Naming:** product, packages, and identifiers are all **Sable** (`@sable/*`, class `Sable`).

---

## Scripts reference

| Command | What it does |
|---|---|
| `bun run chain` | anvil on 127.0.0.1:8545 |
| `bun run build:libs` | tsc build core → sdk → agents |
| `bun run deploy` | local forge deploy |
| `bun run deploy:monad` | Monad testnet forge deploy |
| `bun run seed` | local seed (`scripts/seed.ts`) |
| `bun run seed:monad` | idempotent testnet seed |
| `bun run dev` | libs + `next dev` (local env defaults) |
| `bun run dev:monad` | next dev with Monad env vars |
| `bun run build` | libs + `next build` |
| `bun run recompute` | determinism harness |
| `bun run smoke` | health / precondition checks |
| `bun run test` | `@sable/core` node test runner |
| `cd contracts && forge test` | contract tests |

Always use workspace filters from root: `bun run --filter=@sable/app dev` (not `-w`).

---

## Environment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full table.

App defaults (no env):

- RPC `http://127.0.0.1:8545`
- chainId `31337`
- DB `.data/sable.db`

Testnet values live in `app/.env.local` or `dev:monad` script env.

---

## Testing

```bash
# pure scorer + indexer unit tests
bun run test

# contracts
cd contracts && forge test

# end-to-end smoke (local chain up + deployed)
bun run smoke

# score determinism (API vs pure recompute)
bun run recompute
```

Manual UI: open `/dashboard`, `/leaderboard`, `/explorer`, `/agents/did:agent:atlas`.

---

## Indexer behavior

- Hosted by Next **instrumentation** (Node runtime only).
- Poll interval **400ms**; `eth_getLogs` **chunk size 100** (Monad limit).
- First sync from `SABLE_START_BLOCK` (or genesis), then tail.
- Resume: `kv.last_block` in SQLite.
- Events → `events` table; scores recomputed into `scores` / agents list.

DB files: `app/.data/*.db` (+ `-wal`, `-shm`). Safe to delete for a full resync.

---

## Code conventions

- ESM + TypeScript strict in packages; `tsc -p tsconfig.build.json` for publish shape.
- No comments unless explaining non-obvious domain rules (scorer, chain quirks).
- viem for all chain writes; check **`receipt.status === "success"`** after txs.
- Prefer editing existing files; new files only when adding a real module.
- Secrets only in gitignored `.env*` / `*-bots.json`.
- Product, code, packages: **Sable** (`Sable` / `@sable/*`).

---

## Debugging checklist

1. `curl /api/health` — chainId + counts.
2. Dev log — `[sable] indexer synced` vs `sync failed`.
3. `ls app/.data/` — correct DB for the env you intended.
4. After package change — `bun run build:libs` + restart dev.
5. Testnet tx fail — read DEPLOYMENT.md (reserve, emptying, gas, getLogs).
6. Phantom task / wrong status — confirm SDK `waitOk` rebuild landed.

---

## Git

- Do not commit secrets or `testnet-bots.json`.
- Commit address JSON under `contracts/deployments/` when deploying for the team.
- Run `forge test` + `bun run test` before PR.
