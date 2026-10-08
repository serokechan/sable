/**
 * Chain I/O: viem client + normalization of raw contract logs into the
 * typed ScoreEvent stream. This is the ONLY bridge between the chain and the scorer.
 */

import { createPublicClient, decodeEventLog, http, toHex, defineChain, type PublicClient, type Chain } from "viem";
import { agentRegistryAbi, escrowHubAbi, stakeVaultAbi, type SableAddresses } from "./abis.js";
import type { ScoreEvent } from "./types.js";

export function makeChain(rpcUrl: string, chainId?: number): Chain {
  return defineChain({
    id: chainId ?? 31337,
    name: "sable-dev",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

export function makeClient(rpcUrl: string, chainId?: number): PublicClient {
  return createPublicClient({
    transport: http(rpcUrl, { timeout: 10_000 }),
    chain: makeChain(rpcUrl, chainId),
  });
}

/** every event across the three contracts — the full scorer input surface */
export const ALL_EVENTS_ABI = [
  ...agentRegistryAbi,
  ...stakeVaultAbi,
  ...escrowHubAbi,
] as const;

const CONTRACT_ADDRESSES = ["agentRegistry", "stakeVault", "escrowHub"] as const;

interface RawLog {
  blockNumber: string;
  logIndex: string;
  data: string;
  topics: string[];
}

/** Fetch and normalize all Sable logs in a block range into ScoreEvents, ordered by (block, logIndex). */
export async function fetchScoreEvents(
  client: PublicClient,
  addresses: SableAddresses,
  fromBlock: number,
  toBlock: number,
): Promise<ScoreEvent[]> {
  if (fromBlock > toBlock) return [];

  const rawLogs: RawLog[] = [];
  // Monad testnet caps eth_getLogs at 100 blocks per range.
  const CHUNK_SIZE = 100;

  for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
    for (const name of CONTRACT_ADDRESSES) {
      const logs = (await client.request({
        method: "eth_getLogs",
        params: [
          {
            address: addresses[name],
            fromBlock: toHex(start),
            toBlock: toHex(end),
          },
        ],
      })) as unknown as RawLog[];
      rawLogs.push(...logs);
    }
  }

  rawLogs.sort((a, b) => {
    const bn = Number(BigInt(a.blockNumber)) - Number(BigInt(b.blockNumber));
    if (bn !== 0) return bn;
    return Number(BigInt(a.logIndex)) - Number(BigInt(b.logIndex));
  });

  // resolve block timestamps with bounded concurrency (max 10 parallel RPC calls)
  const tsCache = new Map<number, number>();
  const uniqueBlocks = [...new Set(rawLogs.map((l) => Number(BigInt(l.blockNumber))))];
  const CONCURRENCY = 10;
  for (let i = 0; i < uniqueBlocks.length; i += CONCURRENCY) {
    const slice = uniqueBlocks.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (bn) => {
        const block = await client.getBlock({ blockNumber: BigInt(bn) });
        tsCache.set(bn, Number(block.timestamp));
      }),
    );
  }

  const events: ScoreEvent[] = [];
  for (const log of rawLogs) {
    let decoded: { eventName: string; args: Record<string, unknown> };
    try {
      decoded = decodeEventLog({
        abi: ALL_EVENTS_ABI,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      }) as unknown as { eventName: string; args: Record<string, unknown> };
    } catch {
      continue;
    }

    const block = Number(BigInt(log.blockNumber));
    const ts = tsCache.get(block) ?? 0;
    const a = decoded.args;

    switch (decoded.eventName) {
      case "AgentRegistered":
        events.push({
          kind: "registered",
          agentId: String(a.agentId),
          owner: String(a.owner).toLowerCase(),
          did: String(a.did),
          ts,
          block,
        });
        break;
      case "AgentStatusChanged":
        events.push({ kind: "agent_status", agentId: String(a.agentId), active: Boolean(a.active), ts, block });
        break;
      case "Staked":
        events.push({ kind: "staked", agentId: String(a.agentId), amountWei: String(a.amount), ts, block });
        break;
      case "Unstaked":
        events.push({ kind: "unstaked", agentId: String(a.agentId), amountWei: String(a.amount), ts, block });
        break;
      case "Slashed":
        events.push({
          kind: "slashed",
          agentId: String(a.agentId),
          amountWei: String(a.amount),
          evidenceHash: String(a.evidenceHash),
          ts,
          block,
        });
        break;
      case "TaskCreated":
        events.push({
          kind: "task_created",
          taskId: String(a.taskId),
          hirerAgentId: String(a.hirerAgentId),
          providerAgentId: String(a.providerAgentId),
          amountWei: String(a.amount),
          ts,
          block,
        });
        break;
      case "TaskSettled":
        events.push({
          kind: "task_settled",
          taskId: String(a.taskId),
          providerAgentId: String(a.providerAgentId),
          amountWei: String(a.amount),
          ts,
          block,
        });
        break;
      case "TaskDisputed":
        events.push({
          kind: "task_disputed",
          taskId: String(a.taskId),
          providerAgentId: String(a.providerAgentId),
          ts,
          block,
        });
        break;
      case "TaskRefunded":
        events.push({
          kind: "task_refunded",
          taskId: String(a.taskId),
          providerAgentId: String(a.providerAgentId),
          afterAccept: Boolean(a.afterAccept),
          ts,
          block,
        });
        break;
      case "TaskTimedOut":
        events.push({
          kind: "task_timed_out",
          taskId: String(a.taskId),
          providerAgentId: String(a.providerAgentId),
          afterAccept: Boolean(a.afterAccept),
          ts,
          block,
        });
        break;
    }
  }
  return events;
}

/** Derive DB-facing agent rows from the raw event stream (registration + status only). */
export function agentRowsFromEvents(events: ScoreEvent[]) {
  const rows = new Map<
    string,
    { agentId: string; did: string; owner: string; active: boolean; registeredAt: number }
  >();
  for (const ev of events) {
    if (ev.kind === "registered") {
      if (!rows.has(ev.agentId)) {
        rows.set(ev.agentId, {
          agentId: ev.agentId,
          did: ev.did,
          owner: ev.owner,
          active: true,
          registeredAt: ev.ts,
        });
      }
    } else if (ev.kind === "agent_status") {
      const r = rows.get(ev.agentId);
      if (r) r.active = ev.active;
    }
  }
  return [...rows.values()];
}
