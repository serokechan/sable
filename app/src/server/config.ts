/**
 * Server-side runtime config. Localhost-only by design: no ports exposed
 * beyond the machine.
 */

import { loadLocalAddresses, type SableAddresses } from "@sable/core";

export const RPC_URL = process.env.SABLE_RPC_URL ?? "http://127.0.0.1:8545";
export const CHAIN_ID = Number(process.env.SABLE_CHAIN_ID ?? 31337);
export const DB_PATH = process.env.SABLE_DB_PATH ?? ".data/sable.db";
export const SCORE_API_URL =
  process.env.SABLE_SCORE_API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;

export function loadAddresses(chainId = CHAIN_ID): SableAddresses | null {
  return loadLocalAddresses(chainId);
}
