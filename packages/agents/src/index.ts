/**
 * Demo bots — Atlas (hirer), Nova (star provider), Rex (bad actor).
 *
 * Each bot is a persona backed by a deterministic dev account (the standard
 * Anvil mnemonic, fixed indexes — burnable, demo-only keys). Bots talk through
 * @sable/sdk exactly like any third-party integration would: that's the
 * point — the demo agents are the SDK's first consumers.
 */

import { keccak256, toHex, type Account } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { Sable, type SableConfig, type TrustVerdict } from "@sable/sdk";
import type { ScoreBreakdown } from "@sable/core";

/** Standard Anvil/dev mnemonic — demo-only, burnable. Never use these keys with real funds. */
export const DEV_MNEMONIC = "test test test test test test test test test test test junk";

export const ACCOUNT_INDEX = {
  deployer: 0,
  atlas: 1,
  nova: 2,
  rex: 3,
  treasury: 4,
  backup: 5,
} as const;

/** Derive the same accounts Anvil hands out (m/44'/60'/0'/0/{index}). */
export function accountAt(index: number): Account {
  return mnemonicToAccount(DEV_MNEMONIC, { path: `m/44'/60'/0'/0/${index}` });
}

export interface Persona {
  name: string;
  did: string;
  emoji: string;
  blurb: string;
  accountIndex: number;
}

export const PERSONAS: Record<"atlas" | "nova" | "rex", Persona> = {
  atlas: {
    name: "Atlas",
    did: "did:agent:atlas",
    emoji: "🦉",
    blurb: "Buyer bot — posts tasks, pays only agents it can trust.",
    accountIndex: ACCOUNT_INDEX.atlas,
  },
  nova: {
    name: "Nova",
    did: "did:agent:nova",
    emoji: "⭐",
    blurb: "Star provider — high reliability, long stake history.",
    accountIndex: ACCOUNT_INDEX.nova,
  },
  rex: {
    name: "Rex",
    did: "did:agent:rex",
    emoji: "🦖",
    blurb: "Bad actor — slashed twice, must stake to bootstrap trust.",
    accountIndex: ACCOUNT_INDEX.rex,
  },
};

export class DemoBot {
  readonly persona: Persona;
  readonly account: Account;
  readonly k: Sable;

  constructor(persona: Persona, config: SableConfig, account?: Account) {
    this.persona = persona;
    this.account = account ?? accountAt(persona.accountIndex);
    this.k = new Sable({ ...config, account: this.account });
  }

  get address() {
    return this.account.address;
  }

  async trustCheck(minScore = 500): Promise<TrustVerdict> {
    return this.k.check(this.persona.did, minScore);
  }

  /** Trust-check another agent — the hirer-side call. */
  async vet(providerDid: string, minScore = 500): Promise<TrustVerdict> {
    return this.k.check(providerDid, minScore);
  }

  async postTask(providerDid: string, amountWei: bigint, spec: string, timeoutSeconds = 86400n) {
    const providerAgentId = await this.k.resolveAgentId(providerDid);
    return this.k.createEscrow({
      providerAgentId,
      amountWei,
      specHash: keccak256(toHex(spec)),
      timeoutSeconds,
    });
  }

  async accept(taskId: bigint) {
    return this.k.providerAction(taskId, "accept");
  }

  async deliver(taskId: bigint, deliverable: string) {
    return this.k.providerAction(taskId, "deliver", keccak256(toHex(deliverable)));
  }

  async acceptDelivery(taskId: bigint) {
    return this.k.acceptDelivery(taskId);
  }
}

export interface BotSet {
  atlas: DemoBot;
  nova: DemoBot;
  rex: DemoBot;
  deployer: Account;
}

export interface CreateBotsOptions extends SableConfig {
  /** Override bot accounts (e.g. fresh testnet keys — anvil mnemonics may be EIP-7702 delegated on public chains). */
  accounts?: Partial<Record<"atlas" | "nova" | "rex" | "deployer", Account>>;
}

export function createBots(config: CreateBotsOptions): BotSet {
  const { accounts, ...sableConfig } = config;
  return {
    atlas: new DemoBot(PERSONAS.atlas, sableConfig, accounts?.atlas),
    nova: new DemoBot(PERSONAS.nova, sableConfig, accounts?.nova),
    rex: new DemoBot(PERSONAS.rex, sableConfig, accounts?.rex),
    deployer: accounts?.deployer ?? accountAt(ACCOUNT_INDEX.deployer),
  };
}

export type { ScoreBreakdown };
