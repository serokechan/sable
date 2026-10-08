/**
 * Seed the local chain with the demo cast: Atlas (trusted buyer), Nova (star
 * provider), Rex (slashed bad actor). Runs REAL transactions — the scores the
 * scorer lands on are earned, not minted.
 *
 * Time-travel via anvil cheatcodes gives the agents stake·days and tenure.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  toHex,
} from "viem";
import { escrowHubAbi, makeChain, stakeVaultAbi, type SableAddresses } from "@sable/core";
import { createBots } from "@sable/agents";
import fs from "node:fs";
import path from "node:path";

const RPC_URL = process.env.SABLE_RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.SABLE_CHAIN_ID ?? 31337);
const REPO = path.resolve(import.meta.dirname ?? ".", "..");
const ADDRESSES: SableAddresses = JSON.parse(
  fs.readFileSync(path.join(REPO, "contracts", "deployments", `${CHAIN_ID}.json`), "utf8"),
);

const client = createPublicClient({ transport: http(RPC_URL), chain: makeChain(RPC_URL, CHAIN_ID) });
const bots = createBots({ rpcUrl: RPC_URL, addresses: ADDRESSES });
const deployerWallet = createWalletClient({
  chain: makeChain(RPC_URL, CHAIN_ID),
  transport: http(RPC_URL),
  account: bots.deployer,
});

const DAY = 86_400;

async function warp(seconds: number) {
  try {
    await client.request({ method: "evm_increaseTime", params: [toHex(seconds)] } as never);
    await client.request({ method: "evm_mine" } as never);
  } catch {
    // Live chain: cheatcodes not supported
  }
}

type Outcome = "settle" | "dispute" | "abandon";

async function runCycle(
  hirer: typeof bots.atlas,
  providerDid: string,
  provider: typeof bots.nova,
  amountEth: string,
  outcome: Outcome,
) {
  const taskId = await hirer.postTask(
    providerDid,
    parseEther(amountEth),
    `task ${Date.now()}-${Math.random()}`,
    BigInt(DAY),
  );
  await provider.accept(taskId);

  if (outcome === "settle") {
    await provider.deliver(taskId, `deliverable ${taskId}`);
    await hirer.acceptDelivery(taskId);
    return taskId;
  }

  if (outcome === "dispute") {
    await provider.deliver(taskId, `deliverable ${taskId}`);
    await hirer.k.dispute(taskId);
    const hash = await deployerWallet.writeContract({
      address: ADDRESSES.escrowHub,
      abi: escrowHubAbi,
      functionName: "resolve",
      args: [taskId, false], // resolved against the provider
    });
    await client.waitForTransactionReceipt({ hash });
    return taskId;
  }

  // abandon: provider accepted but never delivered — timeout counts against them
  await warp(2 * DAY);
  const hash = await deployerWallet.writeContract({
    address: ADDRESSES.escrowHub,
    abi: escrowHubAbi,
    functionName: "claimTimeout",
    args: [taskId],
  });
  await client.waitForTransactionReceipt({ hash });
  return taskId;
}

async function main() {
  console.log("→ seeding demo cast on", RPC_URL);

  // 1 — register the three agents (real ERC-8004-style identities)
  for (const bot of [bots.atlas, bots.nova, bots.rex]) {
    await bot.k.registerAgent({
      did: bot.persona.did,
      metadataURI: `ipfs://sable-${bot.persona.name.toLowerCase()}`,
      endpoint: `https://${bot.persona.name.toLowerCase()}.example/pay`,
    });
    console.log(`  registered ${bot.persona.did}`);
  }
  const atlasId = await bots.atlas.k.resolveAgentId("did:agent:atlas");
  const novaId = await bots.nova.k.resolveAgentId("did:agent:nova");
  const rexId = await bots.rex.k.resolveAgentId("did:agent:rex");

  // 2 — let tenure accrue
  await warp(35 * DAY);

  // 3 — stake (skin in the game)
  await bots.atlas.k.stake(atlasId, parseEther("500"));
  await bots.nova.k.stake(novaId, parseEther("300"));
  await warp(10 * DAY); // Atlas: 5000 stake·days (max), Nova: 3000 (max)
  await bots.rex.k.stake(rexId, parseEther("5"));
  await warp(DAY); // Rex: 5 stake·days (unproven)

  // 4 — work history (real escrow cycles)
  console.log("  Atlas: 25 settled tasks (as provider, hired by Nova)");
  for (let i = 0; i < 25; i++) {
    await runCycle(bots.nova, "did:agent:atlas", bots.atlas, "4", "settle");
  }
  console.log("  Nova: 20 settled + 1 disputed (hired by Atlas)");
  for (let i = 0; i < 20; i++) {
    await runCycle(bots.atlas, "did:agent:nova", bots.nova, "5", "settle");
  }
  await runCycle(bots.atlas, "did:agent:nova", bots.nova, "5", "dispute");
  console.log("  Rex: 5 settled + 1 abandoned (hired by Atlas)");
  for (let i = 0; i < 5; i++) {
    await runCycle(bots.atlas, "did:agent:rex", bots.rex, "5", "settle");
  }
  await runCycle(bots.atlas, "did:agent:rex", bots.rex, "5", "abandon");

  // 5 — slash Rex twice with public evidence (MVP: deployer-governed)
  for (const [i, hex] of ["a", "b"].entries()) {
    const hash = await deployerWallet.writeContract({
      address: ADDRESSES.stakeVault,
      abi: stakeVaultAbi,
      functionName: "slash",
      args: [rexId, parseEther("1.5"), ("0x" + hex.repeat(64)) as `0x${string}`],
    });
    await client.waitForTransactionReceipt({ hash });
  }
  console.log("  Rex slashed ×2 (evidence hashes public)");

  console.log("\n✓ seed complete — the indexer picks everything up within ~1s");
  console.log(`  agents: Atlas #${atlasId}, Nova #${novaId}, Rex #${rexId}`);
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
