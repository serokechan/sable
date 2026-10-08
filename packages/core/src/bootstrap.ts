/**
 * Bootstrap helpers that require Node built-ins. Lives in @sable/core so
 * app bundles never touch node:fs/node:sqlite directly (core is always a
 * server-external, native Node dependency).
 */

import fs from "node:fs";
import path from "node:path";
import type { SableAddresses } from "./abis.js";

export function loadAddressesFile(file: string): SableAddresses | null {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      chainId: raw.chainId,
      agentRegistry: raw.agentRegistry,
      stakeVault: raw.stakeVault,
      escrowHub: raw.escrowHub,
    };
  } catch {
    return null;
  }
}

/**
 * Load deployments/<chainId>.json. Default layout: run with cwd = app/,
 * contracts/ one level up (npm workspaces).
 */
export function loadLocalAddresses(chainId = 31337, deploymentsDir?: string): SableAddresses | null {
  const dir =
    deploymentsDir ?? path.resolve(process.cwd(), "..", "contracts", "deployments");
  return loadAddressesFile(path.join(dir, `${chainId}.json`));
}
