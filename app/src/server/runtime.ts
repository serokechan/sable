/**
 * Shared server singletons (DB handle + Sable/SDK config).
 * globalThis-guarded: Next.js dev hot reload must not open a second connection
 * or restart the indexer.
 */

import { SableDB, type SableAddresses } from "@sable/core";
import { Sable } from "@sable/sdk";
import { DB_PATH, RPC_URL, SCORE_API_URL, loadAddresses } from "./config.js";

export interface SableRuntime {
  db: SableDB;
  addresses: SableAddresses;
  sdk: Sable;
}

export function getRuntime(): SableRuntime {
  const g = globalThis as unknown as { __sableRuntime?: SableRuntime };
  if (!g.__sableRuntime) {
    const addresses = loadAddresses();
    if (!addresses) {
      throw new Error(
        "Sable contracts not deployed. Run: npm run chain (anvil), then npm run deploy.",
      );
    }
    const db = new SableDB(DB_PATH);
    const sdk = new Sable({
      rpcUrl: RPC_URL,
      addresses,
      scoreApiUrl: SCORE_API_URL,
      account: undefined,
    });
    g.__sableRuntime = { db, addresses, sdk };
  }
  return g.__sableRuntime;
}
