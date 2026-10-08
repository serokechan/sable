/// Human-readable ABIs for the Sable P0 contract stack.
/// Shared by the indexer, SDK, demo agents and scripts.

import { parseAbi } from "viem";

const agentRegistryHumanAbi = [
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string did, string metadataURI, string endpoint, bytes32 metadataHash)",
  "event AgentUpdated(uint256 indexed agentId, string metadataURI, string endpoint, bytes32 metadataHash)",
  "event AgentStatusChanged(uint256 indexed agentId, bool active)",

  "function register(string did, string metadataURI, string endpoint, bytes32 metadataHash) returns (uint256 agentId)",
  "function update(uint256 agentId, string metadataURI, string endpoint, bytes32 metadataHash)",
  "function setActive(uint256 agentId, bool active)",
  "function agentById(uint256 agentId) view returns (address owner, bool active)",
  "function agentIdByOwner(address owner) view returns (uint256)",
  "function agentIdByDid(string did) view returns (uint256)",
  "function didOf(uint256 agentId) view returns (string)",
  "function resolve(string did) view returns ((address owner, string did, string metadataURI, string endpoint, bytes32 metadataHash, bool active, uint64 registeredAt))",
  "function nextAgentId() view returns (uint256)",
  "error EmptyDid()",
];

export const agentRegistryAbi = parseAbi(agentRegistryHumanAbi);

const stakeVaultHumanAbi = [
  "event Staked(uint256 indexed agentId, address indexed from, uint256 amount, uint256 newTotal)",
  "event UnstakeInitiated(uint256 indexed agentId, uint256 amount, uint64 availableAt)",
  "event UnstakeCancelled(uint256 indexed agentId)",
  "event Unstaked(uint256 indexed agentId, uint256 amount)",
  "event Slashed(uint256 indexed agentId, uint256 amount, bytes32 indexed evidenceHash, uint256 remaining)",

  "function stake(uint256 agentId) payable",
  "function initiateUnstake(uint256 agentId)",
  "function cancelUnstake(uint256 agentId)",
  "function completeUnstake(uint256 agentId)",
  "function slash(uint256 agentId, uint256 amount, bytes32 evidenceHash)",
  "function stakeOf(uint256 agentId) view returns (uint256)",
  "function unstakeRequestedAt(uint256 agentId) view returns (uint64)",
  "function lastEvidenceHash(uint256 agentId) view returns (bytes32)",
  "function UNSTAKE_COOLDOWN() view returns (uint256)",
  "function slashAuthority() view returns (address)",
];

export const stakeVaultAbi = parseAbi(stakeVaultHumanAbi);

const escrowHubHumanAbi = [
  "event TaskCreated(uint256 indexed taskId, uint256 indexed hirerAgentId, uint256 indexed providerAgentId, address hirer, uint256 amount, bytes32 specHash, uint64 timeoutAt)",
  "event TaskAccepted(uint256 indexed taskId, uint256 indexed providerAgentId)",
  "event TaskDelivered(uint256 indexed taskId, bytes32 indexed deliverableHash)",
  "event TaskSettled(uint256 indexed taskId, uint256 indexed providerAgentId, uint256 indexed hirerAgentId, uint256 amount)",
  "event TaskDisputed(uint256 indexed taskId, uint256 indexed hirerAgentId, uint256 indexed providerAgentId)",
  "event TaskResolved(uint256 indexed taskId, bool providerWins)",
  "event TaskRefunded(uint256 indexed taskId, uint256 indexed hirerAgentId, uint256 indexed providerAgentId, bool afterAccept)",
  "event TaskTimedOut(uint256 indexed taskId, uint256 indexed hirerAgentId, uint256 indexed providerAgentId, bool afterAccept)",

  "function create(uint256 providerAgentId, bytes32 specHash, uint64 timeoutSeconds) payable returns (uint256 taskId)",
  "function accept(uint256 taskId)",
  "function deliver(uint256 taskId, bytes32 deliverableHash)",
  "function acceptDelivery(uint256 taskId)",
  "function dispute(uint256 taskId)",
  "function resolve(uint256 taskId, bool providerWins)",
  "function refund(uint256 taskId)",
  "function claimTimeout(uint256 taskId)",
  "function nextTaskId() view returns (uint256)",
];

export const escrowHubAbi = parseAbi(escrowHubHumanAbi);

export const sableAbis = {
  agentRegistry: agentRegistryAbi,
  stakeVault: stakeVaultAbi,
  escrowHub: escrowHubAbi,
} as const;

export interface SableAddresses {
  chainId: number;
  agentRegistry: `0x${string}`;
  stakeVault: `0x${string}`;
  escrowHub: `0x${string}`;
}
