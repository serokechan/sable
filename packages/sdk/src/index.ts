/**
 * @sable/sdk — the 10-line integration that sells the product.
 *
 *   import { Sable } from "@sable/sdk";
 *   const k = new Sable({ rpcUrl, addresses, scoreApiUrl });
 *   const agent = await k.trust.check("did:agent:nova");
 *   if (agent.score < 500) throw new TrustPolicyError(agent);
 *
 * No custodial anything — agent wallets stay with their owners.
 */

import {
  agentRegistryAbi,
  escrowHubAbi,
  makeChain,
  makeClient,
  stakeVaultAbi,
  type SableAddresses,
  type ScoreBreakdown,
} from "@sable/core";
import {
  createWalletClient,
  decodeEventLog,
  http,
  type Account,
  type Chain,
  type Transport,
  type WalletClient,
} from "viem";

export interface SableConfig {
  rpcUrl: string;
  addresses: SableAddresses;
  /** base URL of the score API (e.g. http://127.0.0.1:3000) for cached score reads */
  scoreApiUrl?: string;
  /** pre-built wallet client (browser injected provider, or bot's viem wallet) */
  wallet?: WalletClient;
  /** or a raw account (server/bots): viem Account or hex private-key-derived address */
  account?: Account | `0x${string}`;
}

export interface TrustVerdict {
  did: string;
  agentId: string | null;
  active: boolean;
  owner: string | null;
  endpoint: string | null;
  score: number;
  breakdown: ScoreBreakdown | null;
  verdict: "pass" | "reject";
  minScore: number;
  reasons: string[];
}

export class TrustPolicyError extends Error {
  readonly verdict: TrustVerdict;
  constructor(verdict: TrustVerdict) {
    super(
      `Trust policy rejected ${verdict.did || "<no did>"}: score ${verdict.score} < required ${verdict.minScore}` +
        (verdict.reasons.length ? ` (${verdict.reasons.join("; ")})` : ""),
    );
    this.name = "TrustPolicyError";
    this.verdict = verdict;
  }
}

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

export class Sable {
  readonly config: SableConfig;
  private readonly client;

  constructor(config: SableConfig) {
    this.config = config;
    this.client = makeClient(config.rpcUrl);
  }

  /** ---------- trust: the money API ---------- */

  async check(
    did: string,
    minScore = 500,
    opts?: { allowSlashed?: boolean },
  ): Promise<TrustVerdict> {
    const [record, breakdown] = await Promise.all([
      this.resolveOnchain(did),
      this.getScore(did),
    ]);

    const reasons: string[] = [];
    if (!record) reasons.push("agent not registered onchain");
    if (record && !record.active) reasons.push("agent deactivated");
    if (!breakdown) reasons.push("no score computed yet");
    if (breakdown && breakdown.coldStart) reasons.push("cold-start capped (unproven agent)");
    if (breakdown && breakdown.stats.slashCount > 0)
      reasons.push(
        `${breakdown.stats.slashCount} slash event${breakdown.stats.slashCount > 1 ? "s" : ""}`,
      );

    const score = breakdown?.score ?? 0;
    const hardFail =
      !record ||
      !record.active ||
      !breakdown ||
      score < minScore ||
      (!opts?.allowSlashed && breakdown.stats.slashCount > 0);
    return {
      did,
      agentId: record?.agentId ?? null,
      active: record?.active ?? false,
      owner: record?.owner ?? null,
      endpoint: record?.endpoint ?? null,
      score,
      breakdown,
      verdict: hardFail ? "reject" : "pass",
      minScore,
      reasons,
    };
  }

  private async resolveOnchain(did: string) {
    try {
      const agentId = (await this.client.readContract({
        address: this.config.addresses.agentRegistry,
        abi: agentRegistryAbi,
        functionName: "agentIdByDid",
        args: [did],
      })) as bigint;
      if (agentId === 0n) return null;

      let owner = "0x0" as `0x${string}`;
      let active = false;
      let endpoint: string | null = null;

      try {
        const agent = (await this.client.readContract({
          address: this.config.addresses.agentRegistry,
          abi: agentRegistryAbi,
          functionName: "resolve",
          args: [did],
        })) as {
          owner: `0x${string}`;
          did: string;
          metadataURI: string;
          endpoint: string;
          metadataHash: `0x${string}`;
          active: boolean;
          registeredAt: bigint;
        };
        owner = agent.owner;
        active = agent.active;
        endpoint = agent.endpoint || null;
      } catch {
        const [o, a] = (await this.client.readContract({
          address: this.config.addresses.agentRegistry,
          abi: agentRegistryAbi,
          functionName: "agentById",
          args: [agentId],
        })) as [`0x${string}`, boolean];
        owner = o;
        active = a;
      }

      return {
        owner,
        active,
        endpoint,
        agentId: String(agentId),
      };
    } catch {
      return null;
    }
  }

  /** Score via the score API when configured (cached, <50ms). Returns null when unavailable. */
  async getScore(did: string): Promise<ScoreBreakdown | null> {
    if (!this.config.scoreApiUrl) return null;
    try {
      const res = await fetch(
        `${this.config.scoreApiUrl}/api/agents/${encodeURIComponent(did)}/score`,
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { breakdown: ScoreBreakdown };
      return json.breakdown;
    } catch {
      return null;
    }
  }

  async resolveAgentId(did: string): Promise<bigint> {
    const agentId = (await this.client.readContract({
      address: this.config.addresses.agentRegistry,
      abi: agentRegistryAbi,
      functionName: "agentIdByDid",
      args: [did],
    })) as bigint;
    if (agentId === 0n) throw new Error(`Unknown agent DID: ${did}`);
    return agentId;
  }

  /** ---------- escrow / stake / registry (wallet required) ---------- */

  /** Typed wallet: always has a chain and a signing account. */
  walletClient(): WalletClient<Transport, Chain, Account> {
    if (this.config.wallet) {
      const w = this.config.wallet as WalletClient<Transport, Chain, Account>;
      if (!w.account) throw new Error("Sable: provided wallet client has no signing account");
      return w;
    }
    if (this.config.account) {
      return createWalletClient({
        chain: makeChain(this.config.rpcUrl),
        transport: http(this.config.rpcUrl),
        account: this.config.account as Account,
      });
    }
    throw new Error("Sable: no wallet configured (pass `wallet` or `account`)");
  }

  async registerAgent(params: {
    did: string;
    metadataURI: string;
    endpoint: string;
    metadataHash?: `0x${string}`;
  }) {
    const hash = await this.walletClient().writeContract({
      address: this.config.addresses.agentRegistry,
      abi: agentRegistryAbi,
      chain: makeChain(this.config.rpcUrl),
      functionName: "register",
      args: [
        params.did,
        params.metadataURI,
        params.endpoint,
        params.metadataHash ?? ZERO_BYTES32,
      ],
    });
    return this.waitOk(hash);
  }

  async stake(agentId: bigint, amountWei: bigint) {
    const hash = await this.walletClient().writeContract({
      address: this.config.addresses.stakeVault,
      abi: stakeVaultAbi,
      chain: makeChain(this.config.rpcUrl),
      functionName: "stake",
      args: [agentId],
      value: amountWei,
    });
    return this.waitOk(hash);
  }

  /** Wait for a receipt and throw if the tx reverted (e.g. Monad reserve-balance). */
  private async waitOk(hash: `0x${string}`) {
    const receipt = await this.client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Transaction reverted: ${hash}`);
    }
    return receipt;
  }

  /** Create + fund a task escrow; returns the new taskId (via simulation). */
  async createEscrow(params: {
    providerAgentId: bigint;
    amountWei: bigint;
    specHash: `0x${string}`;
    timeoutSeconds?: bigint;
  }): Promise<bigint> {
    const wallet = this.walletClient();
    const request = {
      address: this.config.addresses.escrowHub,
      abi: escrowHubAbi,
      chain: makeChain(this.config.rpcUrl),
      functionName: "create",
      args: [params.providerAgentId, params.specHash, params.timeoutSeconds ?? 86400n],
      value: params.amountWei,
    } as const;
    const { result } = await this.client.simulateContract({ ...request, account: wallet.account });
    const hash = await wallet.writeContract(request);
    const receipt = await this.waitOk(hash);
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: escrowHubAbi,
          data: log.data,
          topics: log.topics,
        }) as unknown as { eventName: string; args: { taskId?: bigint } };
        if (decoded.eventName === "TaskCreated" && decoded.args.taskId) {
          return decoded.args.taskId;
        }
      } catch {
        // continue
      }
    }
    return result;
  }

  async providerAction(taskId: bigint, action: "accept" | "deliver", deliverableHash?: `0x${string}`) {
    const hash = await this.walletClient().writeContract({
      address: this.config.addresses.escrowHub,
      abi: escrowHubAbi,
      chain: makeChain(this.config.rpcUrl),
      functionName: action,
      args: action === "deliver" ? [taskId, deliverableHash ?? ZERO_BYTES32] : [taskId],
    });
    return this.waitOk(hash);
  }

  async acceptDelivery(taskId: bigint) {
    const hash = await this.walletClient().writeContract({
      address: this.config.addresses.escrowHub,
      abi: escrowHubAbi,
      chain: makeChain(this.config.rpcUrl),
      functionName: "acceptDelivery",
      args: [taskId],
    });
    return this.waitOk(hash);
  }

  async dispute(taskId: bigint) {
    const hash = await this.walletClient().writeContract({
      address: this.config.addresses.escrowHub,
      abi: escrowHubAbi,
      chain: makeChain(this.config.rpcUrl),
      functionName: "dispute",
      args: [taskId],
    });
    return this.waitOk(hash);
  }
}

/**
 * Policy middleware — drop-in guard for Express/Fastify/bot handlers:
 *   const policy = sablePolicy(k, { minScore: 500, didOf: req => req.query.did });
 *   const verdict = await policy(req); // throws TrustPolicyError below threshold
 */
export function sablePolicy(
  k: Sable,
  opts: { minScore?: number; didOf: (req: unknown) => string | undefined | null },
) {
  const minScore = opts.minScore ?? 500;
  return async (req: unknown): Promise<TrustVerdict> => {
    const did = opts.didOf(req);
    if (!did) {
      throw new TrustPolicyError({
        did: "",
        agentId: null,
        active: false,
        owner: null,
        endpoint: null,
        score: 0,
        breakdown: null,
        verdict: "reject",
        minScore,
        reasons: ["no agent DID provided"],
      });
    }
    const verdict = await k.check(did, minScore);
    if (verdict.verdict === "reject") throw new TrustPolicyError(verdict);
    return verdict;
  };
}
