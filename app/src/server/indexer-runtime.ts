/**
 * Indexer runtime: starts the chain-indexer worker inside the Next.js server
 * process via instrumentation.ts. The worker keeps SQLite fresh; route
 * handlers only ever read.
 */

import { startIndexer, type IndexerHandle } from "@sable/core";
import { DB_PATH, RPC_URL, loadAddresses } from "./config.js";

export async function startIfNeeded() {
  const g = globalThis as unknown as { __sableIndexer?: IndexerHandle };
  if (g.__sableIndexer) return;

  const addresses = loadAddresses();
  if (!addresses) {
    console.warn(
      "[sable] No contract deployments found — indexer idle. Run `npm run chain` + `npm run deploy`, then restart.",
    );
    return;
  }

  const startBlock = process.env.SABLE_START_BLOCK
    ? Number(process.env.SABLE_START_BLOCK)
    : undefined;

  const handle = startIndexer({
    rpcUrl: RPC_URL,
    addresses,
    dbPath: DB_PATH,
    pollMs: 400,
    startBlock,
    onSynced: (info) => {
      console.log(
        `[sable] indexer synced: block ${info.latestBlock}, ${info.eventCount} events, ${info.scores} agents scored`,
      );
    },
  });
  g.__sableIndexer = handle;
}
