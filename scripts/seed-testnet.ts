/**
 * Light seed for Monad testnet (no anvil cheatcodes).
 *
 * - loads fresh bot keys from contracts/testnet-bots.json
 *   (anvil mnemonic addresses are EIP-7702-delegated on public chains —
 *   value transfers get auto-forwarded and never land)
 * - tops up bots from DEPLOYER_PRIVATE_KEY with emptying-exception spacing
 *   (≈1 value tx / 1.2s per undelegated EOA when balance < 10 MON)
 * - registers Atlas / Nova / Rex, stakes, escrow cycles, one slash
 * - idempotent: safe to re-run after a partial failure
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { escrowHubAbi, makeChain, stakeVaultAbi, type SableAddresses } from "@sable/core";
import { createBots, type DemoBot } from "@sable/agents";
import fs from "node:fs";
import path from "node:path";
import { keccak256, toHex } from "viem";

const RPC_URL = process.env.SABLE_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const CHAIN_ID = Number(process.env.SABLE_CHAIN_ID ?? 10143);
const REPO = path.resolve(import.meta.dirname ?? ".", "..");
const ADDRESSES: SableAddresses = JSON.parse(
  fs.readFileSync(path.join(REPO, "contracts", "deployments", `${CHAIN_ID}.json`), "utf8"),
);

/** emptying exception: one value transfer per k blocks (~1.2s); use 1.8s margin */
const EMPTYING_GAP_MS = 1800;

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(path.join(REPO, "contracts", ".env"));
const DEPLOYER_PK = process.env.DEPLOYER_PRIVATE_KEY;
if (!DEPLOYER_PK) {
  console.error("DEPLOYER_PRIVATE_KEY required (contracts/.env or shell)");
  process.exit(1);
}

const BOTS_FILE = path.join(REPO, "contracts", "testnet-bots.json");
if (!fs.existsSync(BOTS_FILE)) {
  console.error(`missing ${BOTS_FILE} — generate fresh keys first`);
  process.exit(1);
}
const botKeys = JSON.parse(fs.readFileSync(BOTS_FILE, "utf8")) as Record<
  "atlas" | "nova" | "rex",
  { address: string; privateKey: Hex }
>;

const chain = makeChain(RPC_URL, CHAIN_ID);
const client = createPublicClient({ transport: http(RPC_URL), chain });
const deployerAccount = privateKeyToAccount(DEPLOYER_PK as Hex);
const deployerWallet = createWalletClient({
  chain,
  transport: http(RPC_URL),
  account: deployerAccount,
});

const bots = createBots({
  rpcUrl: RPC_URL,
  addresses: ADDRESSES,
  accounts: {
    atlas: privateKeyToAccount(botKeys.atlas.privateKey),
    nova: privateKeyToAccount(botKeys.nova.privateKey),
    rex: privateKeyToAccount(botKeys.rex.privateKey),
    deployer: deployerAccount,
  },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lastValueTxAt = new Map<string, number>();

async function waitEmptying(sender: string) {
  const last = lastValueTxAt.get(sender.toLowerCase()) ?? 0;
  const wait = last + EMPTYING_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
}

async function sendTx(hash: `0x${string}`) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }
  return receipt;
}

/** Retry a value-bearing action when Monad reserve-balance briefly reverts. */
async function withRetry<T>(label: string, run: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await run();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        msg.includes("revert") ||
        msg.includes("reserve") ||
        msg.includes("Insufficient") ||
        msg.includes("emptying");
      if (!retryable || i === attempts - 1) break;
      console.log(`  retry ${label} (${i + 1}/${attempts}) after: ${msg.slice(0, 80)}`);
      await sleep(2500);
    }
  }
  throw lastErr;
}

/** Top up so free balance >= targetMon. No-op when already funded. */
async function topUp(address: string, targetMon: string) {
  const target = parseEther(targetMon);
  const bal = await client.getBalance({ address: address as `0x${string}` });
  if (bal >= target) {
    console.log(`  funded ${address.slice(0, 10)}… ${formatEther(bal)} MON`);
    return;
  }
  const send = target - bal;
  await waitEmptying(deployerAccount.address);
  const hash = await deployerWallet.sendTransaction({
    to: address as `0x${string}`,
    value: send,
    gas: 100_000n,
  });
  lastValueTxAt.set(deployerAccount.address.toLowerCase(), Date.now());
  await sendTx(hash);
  console.log(
    `  topped ${address.slice(0, 10)}… +${formatEther(send)} MON → ${formatEther(target)}`,
  );
}

async function valueTx<T>(sender: string, run: () => Promise<T>): Promise<T> {
  await waitEmptying(sender);
  const result = await run();
  lastValueTxAt.set(sender.toLowerCase(), Date.now());
  return result;
}

async function agentIdOf(did: string): Promise<bigint> {
  return client.readContract({
    address: ADDRESSES.agentRegistry,
    abi: [
      {
        type: "function",
        name: "agentIdByDid",
        stateMutability: "view",
        inputs: [{ name: "did", type: "string" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const,
    functionName: "agentIdByDid",
    args: [did],
  }) as Promise<bigint>;
}

async function stakeOf(agentId: bigint): Promise<bigint> {
  return client.readContract({
    address: ADDRESSES.stakeVault,
    abi: stakeVaultAbi,
    functionName: "stakeOf",
    args: [agentId],
  });
}

async function nextTaskId(): Promise<bigint> {
  return client.readContract({
    address: ADDRESSES.escrowHub,
    abi: [
      {
        type: "function",
        name: "nextTaskId",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const,
    functionName: "nextTaskId",
  });
}

type Outcome = "settle" | "dispute";

async function runCycle(
  hirer: DemoBot,
  providerDid: string,
  provider: DemoBot,
  amountEth: string,
  outcome: Outcome,
) {
  const taskId = await withRetry(`create→${providerDid}`, () =>
    valueTx(hirer.address, () =>
      hirer.postTask(
        providerDid,
        parseEther(amountEth),
        `t${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        86_400n,
      ),
    ),
  );
  await withRetry(`accept#${taskId}`, () => provider.accept(taskId));

  if (outcome === "settle") {
    await withRetry(`deliver#${taskId}`, () => provider.deliver(taskId, `d${taskId}`));
    await withRetry(`settle#${taskId}`, () => hirer.acceptDelivery(taskId));
    return taskId;
  }

  await withRetry(`deliver#${taskId}`, () => provider.deliver(taskId, `d${taskId}`));
  await withRetry(`dispute#${taskId}`, () => hirer.k.dispute(taskId));
  const hash = await deployerWallet.writeContract({
    address: ADDRESSES.escrowHub,
    abi: escrowHubAbi,
    functionName: "resolve",
    args: [taskId, false],
  });
  await sendTx(hash);
  return taskId;
}

async function main() {
  console.log("→ light seed on", RPC_URL, "chain", CHAIN_ID);
  const depBal = await client.getBalance({ address: deployerAccount.address });
  console.log(`  deployer ${deployerAccount.address} (${formatEther(depBal)} MON)`);

  // Free balance targets cover value + gas for remaining cycles (102 gwei).
  await topUp(bots.atlas.address, "0.35");
  await topUp(bots.nova.address, "0.35");
  await topUp(bots.rex.address, "0.15");

  for (const bot of [bots.atlas, bots.nova, bots.rex]) {
    const existing = await agentIdOf(bot.persona.did);
    if (existing !== 0n) {
      console.log(`  already registered ${bot.persona.did} → #${existing}`);
      continue;
    }
    await bot.k.registerAgent({
      did: bot.persona.did,
      metadataURI: `ipfs://sable-${bot.persona.name.toLowerCase()}`,
      endpoint: `https://${bot.persona.name.toLowerCase()}.example/pay`,
    });
    console.log(`  registered ${bot.persona.did}`);
  }

  const atlasId = await agentIdOf("did:agent:atlas");
  const novaId = await agentIdOf("did:agent:nova");
  const rexId = await agentIdOf("did:agent:rex");
  if (!atlasId || !novaId || !rexId) {
    throw new Error("registration incomplete");
  }

  const stakes: Array<[DemoBot, bigint, string]> = [
    [bots.atlas, atlasId, "0.05"],
    [bots.nova, novaId, "0.05"],
    [bots.rex, rexId, "0.02"],
  ];
  for (const [bot, id, amount] of stakes) {
    const current = await stakeOf(id);
    if (current >= parseEther(amount)) {
      console.log(`  stake ok ${bot.persona.did} = ${formatEther(current)}`);
      continue;
    }
    const need = parseEther(amount) - current;
    await valueTx(bot.address, () => bot.k.stake(id, need));
    console.log(`  staked ${bot.persona.did} +${amount} → ${formatEther(await stakeOf(id))}`);
  }

  // How many cycles already created? nextTaskId starts at 1.
  const started = Number((await nextTaskId()) - 1n);
  // Target: 11 cycles total (5 atlas-as-provider + 4 nova + 1 dispute + 2 rex).
  // On re-run, finish whatever is missing (cap so we don't loop forever).
  const remaining = Math.max(0, 11 - started);
  console.log(`  escrow cycles: ${started}/11 done, ${remaining} remaining`);

  let plan: Array<{ hirer: DemoBot; providerDid: string; provider: DemoBot; outcome: Outcome }> = [];
  // rebuild full plan, skip first `started`
  for (let i = 0; i < 5; i++) plan.push({ hirer: bots.nova, providerDid: "did:agent:atlas", provider: bots.atlas, outcome: "settle" });
  for (let i = 0; i < 4; i++) plan.push({ hirer: bots.atlas, providerDid: "did:agent:nova", provider: bots.nova, outcome: "settle" });
  plan.push({ hirer: bots.atlas, providerDid: "did:agent:nova", provider: bots.nova, outcome: "dispute" });
  for (let i = 0; i < 2; i++) plan.push({ hirer: bots.atlas, providerDid: "did:agent:rex", provider: bots.rex, outcome: "settle" });
  plan = plan.slice(started);

  for (const step of plan) {
    const label =
      step.outcome === "dispute"
        ? `dispute ${step.providerDid}`
        : `settle ${step.providerDid}`;
    console.log(`  cycle → ${step.hirer.persona.did} hires ${label}`);
    await runCycle(step.hirer, step.providerDid, step.provider, "0.01", step.outcome);
  }

  // slash once (idempotent via evidence hash check)
  const alreadySlashed = await client.readContract({
    address: ADDRESSES.stakeVault,
    abi: stakeVaultAbi,
    functionName: "lastEvidenceHash",
    args: [rexId],
  });
  if (alreadySlashed !== "0x" + "0".repeat(64)) {
    console.log("  Rex already slashed");
  } else {
    const slashHash = await deployerWallet.writeContract({
      address: ADDRESSES.stakeVault,
      abi: stakeVaultAbi,
      functionName: "slash",
      args: [rexId, parseEther("0.01"), keccak256(toHex("seed-slash-1"))],
    });
    await sendTx(slashHash);
    console.log("  Rex slashed ×1 (deployer admin)");
  }

  console.log("\n✓ light seed complete — indexer picks this up within ~1s");
  console.log(`  agents Atlas #${atlasId}, Nova #${novaId}, Rex #${rexId}`);
}

main().catch((err) => {
  console.error("seed-testnet failed:", err);
  process.exit(1);
});
