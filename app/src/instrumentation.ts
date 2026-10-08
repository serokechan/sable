/**
 * Next.js instrumentation hook — hosts the indexer worker inside the app
 * server process (Node runtime only). All Node built-in usage lives inside
 * @sable/core, which is a serverExternalPackage and never webpack-bundled.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __sableIndexerStarted?: boolean };
  if (g.__sableIndexerStarted) return;
  g.__sableIndexerStarted = true;

  // webpackIgnore keeps @sable/core out of every bundle (incl. the edge
  // compile, which never reaches this line anyway).
  const { loadLocalAddresses, startIndexer } = await import(
    /* webpackIgnore: true */ "@sable/core"
  );
  const chainId = Number(process.env.SABLE_CHAIN_ID ?? 31337);
  const addresses = loadLocalAddresses(chainId);
  if (!addresses) {
    console.warn(
      "[sable] No contract deployments found — indexer idle. Run `npm run chain` + `npm run deploy`, then restart.",
    );
    return;
  }

  const dbPath = process.env.SABLE_DB_PATH ?? ".data/sable.db";
  const rpcUrl = process.env.SABLE_RPC_URL ?? "http://127.0.0.1:8545";
  const startBlock = process.env.SABLE_START_BLOCK
    ? Number(process.env.SABLE_START_BLOCK)
    : undefined;

  const handle = startIndexer({
    rpcUrl,
    addresses,
    dbPath,
    pollMs: 400,
    startBlock,
    onSynced: (info) => {
      console.log(
        `[sable] indexer synced: block ${info.latestBlock}, ${info.eventCount} events, ${info.scores} agents scored`,
      );
    },
  });
  void handle;
}
