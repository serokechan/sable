/**
 * The indexer: polls the chain, persists normalized events + agent rows,
 * and recomputes every score after each batch. Poll-based on purpose —
 * robust against dev-node restarts; a WS subscription is a drop-in upgrade
 * (same fetchScoreEvents normalization either way).
 */

import fs from "node:fs";
import path from "node:path";

import { fetchScoreEvents, agentRowsFromEvents, makeClient } from "./chain.js";
import { SableDB } from "./db.js";
import { computeScores } from "./scorer.js";
import type { SableAddresses } from "./abis.js";

export interface IndexerOptions {
  rpcUrl: string;
  addresses: SableAddresses;
  dbPath: string;
  pollMs?: number;
  /** recompute every score from the full event stream after each batch */
  startBlock?: number;
  onSynced?: (info: { latestBlock: number; eventCount: number; scores: number }) => void;
}

export interface IndexerHandle {
  stop(): void;
  syncOnce(): Promise<{ latestBlock: number; newEvents: number }>;
  db: SableDB;
}

export function startIndexer(opts: IndexerOptions): IndexerHandle {
  fs.mkdirSync(path.dirname(path.resolve(opts.dbPath)), { recursive: true });
  const db = new SableDB(opts.dbPath);
  const client = makeClient(opts.rpcUrl);
  const pollMs = opts.pollMs ?? 500;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  async function syncOnce() {
    const latest = Number(await client.getBlockNumber());
    const from = Math.max(db.lastBlock() + 1, opts.startBlock ?? 0);
    if (latest < from) {
      db.setLastBlock(Math.max(db.lastBlock(), latest));
      return { latestBlock: latest, newEvents: 0 };
    }

    const events = await fetchScoreEvents(client, opts.addresses, from, latest);

    // persist agent rows from registration/status events
    const rows = agentRowsFromEvents(events);
    for (const r of rows) db.upsertAgent(r);

    // persist score events (agent status events are recorded too — the explorer shows them)
    for (const ev of events) {
      const agentIds =
        "agentId" in ev
          ? [ev.agentId]
          : "providerAgentId" in ev
            ? [ev.providerAgentId, ...("hirerAgentId" in ev ? [ev.hirerAgentId] : [])]
            : [];
      db.insertEvent(ev, ev.kind, agentIds);
    }

    if (events.length > 0 || db.lastBlock() < latest) {
      await recomputeAll(latest);
      db.setLastBlock(latest);
    }

    if (opts.onSynced) {
      opts.onSynced({ latestBlock: latest, eventCount: db.countEvents(), scores: db.listAgents().length });
    }
    return { latestBlock: latest, newEvents: events.length };
  }

  async function recomputeAll(latestBlock: number) {
    const latestTs = Number((await client.getBlock({ blockNumber: BigInt(latestBlock) })).timestamp);
    const events = db.allEvents();
    const scores = computeScores(events, latestTs);
    // stamp the block height the score was computed at
    for (const s of Object.values(scores)) s.computedAtBlock = latestBlock;
    db.replaceScores(scores);
  }

  async function loop() {
    if (stopped) return;
    if (running) {
      timer = setTimeout(loop, pollMs);
      return;
    }
    running = true;
    try {
      await syncOnce();
    } catch (err) {
      console.error("[indexer] sync failed:", err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
    if (!stopped) timer = setTimeout(loop, pollMs);
  }

  // initial catch-up synchronously so the API has data ASAP
  const ready = syncOnce()
    .catch((err) => console.error("[indexer] initial sync failed:", err instanceof Error ? err.message : err))
    .then(() => {
      if (!stopped) timer = setTimeout(loop, pollMs);
    });

  return {
    db,
    syncOnce,
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      void ready;
    },
  };
}
