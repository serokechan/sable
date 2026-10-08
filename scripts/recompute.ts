/**
 * Determinism harness — the "is the score really trustless?" answer.
 * Reads ONLY raw chain logs from genesis, recomputes every score with the pure
 * scorer, and diffs against what the API serves. Exit code 1 on any mismatch.
 */

import { createPublicClient, http } from "viem";
import { computeScores, makeChain, type SableAddresses } from "@sable/core";
import { fetchScoreEvents } from "@sable/core";
import fs from "node:fs";
import path from "node:path";

const RPC_URL = process.env.SABLE_RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.SABLE_CHAIN_ID ?? 31337);
const REPO = path.resolve(import.meta.dirname ?? ".", "..");
const ADDRESSES: SableAddresses = JSON.parse(
  fs.readFileSync(path.join(REPO, "contracts", "deployments", `${CHAIN_ID}.json`), "utf8"),
);
const API = process.env.SABLE_SCORE_API_URL ?? "http://127.0.0.1:3000";

async function main() {
  const client = createPublicClient({ transport: http(RPC_URL), chain: makeChain(RPC_URL, CHAIN_ID) });
  const latest = Number(await client.getBlockNumber());
  console.log(`→ recompute: reading genesis → block ${latest} from ${RPC_URL}`);

  const events = await fetchScoreEvents(client, ADDRESSES, 0, latest);
  const latestTs = Number((await client.getBlock({ blockNumber: BigInt(latest) })).timestamp);
  const recomputed = computeScores(events, latestTs);

  // fetch what the API currently serves
  const res = await fetch(`${API}/api/agents`);
  if (!res.ok) {
    console.error(`✗ API unavailable (${res.status}) — start the app first`);
    process.exit(2);
  }
  const { agents } = (await res.json()) as {
    agents: { did: string; score: number; breakdown: { computedAtTs: number } | null }[];
  };

  let mismatches = 0;
  console.log("\n  did                 chain-recompute   api   verdict");
  console.log("  " + "-".repeat(58));
  for (const agent of agents) {
    const local = Object.values(recomputed).find((s) => s.did === agent.did);
    const chainScore = local?.score ?? 0;
    const ok = chainScore === agent.score;
    if (!ok) mismatches++;
    console.log(
      `  ${agent.did.padEnd(20)}${String(chainScore).padStart(8)}${String(agent.score).padStart(8)}   ${
        ok ? "✓ match" : "✗ MISMATCH"
      }`,
    );
  }
  for (const [agentId, s] of Object.entries(recomputed)) {
    if (!agents.some((a) => a.did === s.did)) {
      console.log(`  (unlisted) agent #${agentId} → ${s.score} (indexer may still be catching up)`);
    }
  }

  if (mismatches > 0) {
    console.error(`\n✗ ${mismatches} mismatch(es) — determinism broken!`);
    process.exit(1);
  }
  console.log(`\n✓ all scores recompute identically from raw chain data (${events.length} events consumed)`);
}

main().catch((err) => {
  console.error("recompute failed:", err);
  process.exit(1);
});
