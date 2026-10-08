# Deployment & Testnet Runbook

How Sable is deployed, seeded, and operated — local Anvil and Monad testnet.

---

## Environments

| | Local | Monad testnet |
|---|---|---|
| Chain ID | 31337 | **10143** |
| RPC | `http://127.0.0.1:8545` | `https://testnet-rpc.monad.xyz` |
| Deploy | `bun run deploy` | `bun run deploy:monad` |
| Seed | `bun run seed` | `bun run seed:monad` |
| App | `bun run dev` | `bun run dev:monad` or `app/.env.local` |
| Addresses file | `contracts/deployments/31337.json` | `contracts/deployments/10143.json` |
| Indexer DB | `.data/sable.db` | `.data/sable-monad.db` |
| Bot keys | Anvil mnemonic | `contracts/testnet-bots.json` |

Deployments are keyed by chain ID — app loads `deployments/<SABLE_CHAIN_ID>.json`.

---

## 1. Contracts

### Prereqs

- Foundry on PATH: `export PATH="$PATH:$HOME/.foundry/bin"`
- `contracts/.env`:

```bash
DEPLOYER_PRIVATE_KEY=0x…   # gitignored
# optional overrides
SABLE_RPC_URL=https://testnet-rpc.monad.xyz
```

### Local

```bash
bun run chain     # terminal 1
bun run deploy    # writes deployments/31337.json
```

### Monad testnet

```bash
# wallet needs testnet MON: https://faucet.monad.xyz/
set -a && . contracts/.env && set +a
bun run deploy:monad
# → forge script script/Deploy.s.sol --broadcast
# → contracts/deployments/10143.json
```

**Current testnet addresses (seeded demo):**

| Contract | Address |
|---|---|
| AgentRegistry | `0xf21C830E35795D6F8d57B7CABcD9Cf90F680952F` |
| StakeVault | `0x8a5D503dcd61DE905525088692269aA03d3F113D` |
| EscrowHub | `0xe2fF217a84385f644D7e46c1292468C80DC3baf4` |

Indexer start block for this deploy: **`65176384`** (set `SABLE_START_BLOCK`).

After a **new** deploy: update `SABLE_START_BLOCK`, wipe `SABLE_DB_PATH*`, restart app.

---

## 2. Seed

Seed is **idempotent**: re-runs skip existing registrations/stakes, top up bot balances, and only run missing escrow cycles (including one slash).

```bash
# local
bun run seed

# testnet (needs .env deployer for slash authority)
set -a && . ./.env && set +a   # or contracts/.env
bun run seed:monad
```

Script: [`scripts/seed-testnet.ts`](../scripts/seed-testnet.ts).

Creates / maintains:

- Agents: `did:agent:atlas`, `did:agent:nova`, `did:agent:rex`
- Stakes, multi-step escrows (settle + one dispute/slash)
- Fresh keys loaded from `contracts/testnet-bots.json` when present

---

## 3. App + indexer

### Local

```bash
bun run dev
```

### Testnet

Preferred: `app/.env.local` (loaded by Next automatically):

```bash
SABLE_RPC_URL=https://testnet-rpc.monad.xyz
SABLE_CHAIN_ID=10143
SABLE_DB_PATH=.data/sable-monad.db
SABLE_START_BLOCK=65176384
SABLE_BOTS_FILE=/absolute/path/to/contracts/testnet-bots.json
```

Or one-shot from repo root:

```bash
bun run dev:monad
```

Instrumentation (`app/src/instrumentation.ts`) starts the indexer inside the Next process. Log line on success:

```text
[sable] indexer synced: block …, N events, M agents scored
```

Health check:

```bash
curl -s http://127.0.0.1:3000/api/health
```

---

## 4. Monad-specific constraints

### Reserve balance (~10 MON/EOA)

Monad enforces a minimum undelegated balance per EOA.

| Tx type | Behavior |
|---|---|
| Gas-only (`value = 0`) | Always OK |
| Value transfer / contract call with value | Must not drop free balance below reserve |
| Emptying exception | Roughly one value tx per few blocks from undelegated EOA |

**Mitigations in this repo:**

- Seed: emptying-aware delays + retries (`withRetry` on revert).
- SDK: `waitOk` throws if `receipt.status !== "success"` (no phantom success from simulate).
- Gas limit for value contract calls: **≥ 100_000** (not 21_000).

### `eth_getLogs` range limit

Public Monad RPC rejects large ranges (**100 blocks** max → `-32614` / 413).

- `packages/core` `CHUNK_SIZE = 100`
- Keep this if you raise concurrency later.

### Do not reuse Anvil addresses on public chains

Anvil mnemonic addresses may be **EIP-7702 delegated** after prior experiments — incoming value can auto-forward to a code address and break funding assumptions.

- Use **fresh bot keys** (`contracts/testnet-bots.json`, gitignored).
- Never fund anvil mnemonics on testnet/mainnet.

### Gas price

~100 gwei class is normal; escrow cycles need free balance headroom (~0.15–0.35 MON per bot for a full seed).

---

## 5. Secrets & git hygiene

| Path | Contents | Git |
|---|---|---|
| `.env` (root), `contracts/.env` | `DEPLOYER_PRIVATE_KEY` | ignored |
| `contracts/testnet-bots.json` | bot private keys | ignored |
| `contracts/deployments/*.json` | addresses only | committed |
| `app/.env.local` | runtime env | typically ignored (`.env*.local`) |

Never commit private keys. Rotate bot keys if a repo is shared.

---

## 6. Reset testnet data (index only)

Safe — does not touch chain:

```bash
# stop app
rm -f app/.data/sable-monad.db app/.data/sable-monad.db-*
# optionally set SABLE_START_BLOCK to deploy block
bun run dev:monad   # re-index from start block
```

Full **new** contracts: redeploy → update start block → wipe DB → reseed.

---

## 7. Smoke / verify

```bash
bun run smoke           # health + preconditions (local-oriented)
bun run recompute       # determinism vs API
cd contracts && forge test
curl -s localhost:3000/api/health | jq
curl -s localhost:3000/api/agents | jq '.agents[].did,.agents[].score'
```

Explorer: open a tx hash from seed on MonadVision (chain 10143).

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| health `agents:0` after start | initial sync still running | wait; watch `[sable] indexer synced` |
| indexer error 413 / `-32614` | getLogs range > 100 | ensure `CHUNK_SIZE=100` |
| `Transaction reverted` on seed | reserve / emptying / OOG | retry (seed does); gas ≥ 100k for value |
| `NotProvider()` on accept | phantom taskId (create reverted) | upgrade SDK `waitOk`; recreate task |
| `No contract deployments found` | wrong chainId / missing json | check `SABLE_CHAIN_ID` + deployments file |
| Score stale after seed | poll lag | ~0.4–1s; or hit `/api/health` then refresh UI |
| Wrong contracts after redeploy | old DB | wipe DB + update `SABLE_START_BLOCK` |
