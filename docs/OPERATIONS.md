# Operations Runbook

Day-2 operations: start/stop, health, reindex, rotate keys, incident checks.

Companion: [DEPLOYMENT.md](DEPLOYMENT.md) · [API.md](API.md) · [DEVELOPMENT.md](DEVELOPMENT.md).

---

## Service model (dev / hackathon)

Single Node process (`next dev` or `next start`) hosts:

1. HTTP API + dashboard  
2. Indexer worker (via `instrumentation.ts`)

No separate indexer daemon in P0. Logs go to the process stdout.

---

## Start / stop

### Local

```bash
bun run chain          # if not running
bun run deploy && bun run seed
bun run dev
```

### Monad testnet

```bash
# ensure app/.env.local or dev:monad env
bun run dev:monad
# or: bun run --filter=@sable/app start   # after bun run build, production-ish
```

Stop: Ctrl+C on the process, or kill the PID bound to `127.0.0.1:3000`.

**Do not kill unrelated services** (e.g. other agents on this machine) when freeing port 3000 — kill only the Next PID.

---

## Health checks

```bash
curl -sf http://127.0.0.1:3000/api/health | jq
```

| Field | Healthy |
|---|---|
| `ok` | `true` |
| `chainId` | expected (31337 or 10143) |
| `agents` / `events` | > 0 after seed (monotonically ↑ while syncing) |

Log line:

```text
[sable] indexer synced: block N, E events, S agents scored
```

Absence after ~60s on testnet → check RPC and `SABLE_START_BLOCK`.

---

## Metrics you can poll

No Prometheus in P0. Cheap proxies:

```bash
# counts
curl -s localhost:3000/api/health | jq '{agents,events,chainId}'

# latest events (sync lag signal)
curl -s 'localhost:3000/api/events?limit=1' | jq '.events[0].block'
```

Compare latest event block to chain head if lag matters.

---

## Reindex (wipe cache only)

Safe: does not change chain state.

```bash
# stop app
rm -f app/.data/sable.db app/.data/sable.db-*
rm -f app/.data/sable-monad.db app/.data/sable-monad.db-*
bun run dev            # or dev:monad
```

Confirm health counts climb, then `[sable] indexer synced`.

---

## Reseed (idempotent testnet)

```bash
set -a && . contracts/.env && set +a
bun run seed:monad
```

Safe to re-run: skips completed registers/stakes, tops up balances, fills missing cycles.

Needs: deployer key (slash), bot keys funded, RPC reachable.

---

## Redeploy contracts

1. `bun run deploy:monad` (or local `bun run deploy`)
2. Note new addresses in `contracts/deployments/<chainId>.json`
3. Set `SABLE_START_BLOCK` = deploy block
4. Wipe indexer DB
5. Restart app
6. `bun run seed:monad` if you want demo data again

Old addresses stop being indexed; dashboard will show new set only.

---

## Key material

| Asset | Location | Rotate |
|---|---|---|
| Deployer | `contracts/.env`, root `.env` | new key + faucet; update env; redeploy if needed |
| Demo bots | `contracts/testnet-bots.json` | generate new JSON; update `SABLE_BOTS_FILE`; reseed identities if owner changes |

Never paste keys into tickets, chat, or committed files.

If a key is exposed: treat funds as gone; rotate bots; **do not** reuse on mainnet.

---

## Incident cheat sheet

| Severity | Symptom | First action |
|---|---|---|
| P0 | app down | check port 3000 PID, restart `dev` / `dev:monad` |
| P0 | `ok:false` health | logs — missing deployments or DB lock |
| P1 | scores stale | indexer log; RPC; `last_block` in DB |
| P1 | seed txs fail | DEPLOYMENT.md reserve / emptying / gas |
| P1 | `eth_getLogs` 413 | confirm `CHUNK_SIZE=100` in built core |
| P2 | UI wrong network | `chainId` in health vs expected; `.env.local` |
| P2 | demo button no-op | `SABLE_BOTS_FILE`, bot MON balance |

Collect for a bug report:

```bash
curl -s localhost:3000/api/health
ls -la app/.data/
# last 100 lines of process log
# failing tx hash / RPC error string
```

---

## Capacity notes (hackathon scale)

- SQLite WAL: fine for single writer + dashboard readers.
- Poll 400ms + 100-block chunks: plenty for testnet volume.
- Not tuned for public multi-writer production — Postgres + separate worker is the upgrade path (architecture doc).

---

## Backup

Index is disposable. **Do not** treat `.data/*.db` as source of truth.

Source of truth = chain. Optional: copy `contracts/deployments/*.json` + env templates; keys backed up offline separately.
