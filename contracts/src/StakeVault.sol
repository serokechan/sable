// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAgentRegistry} from "./IAgentRegistry.sol";

/// @title StakeVault — skin in the game (Sable Layer 1)
/// @notice Stake native MON (ETH on any EVM). Unstake has a cooldown. Slashing is
/// governance-keyed in the MVP with a public evidence hash; the trustless core is the
/// escrow state machine in EscrowHub. Roadmap: evaluator-set slashing via bonded arbiters.
contract StakeVault {
    uint256 public constant UNSTAKE_COOLDOWN = 7 days;

    IAgentRegistry public immutable registry;
    address public slashAuthority; // multisig in production; deployer in dev
    address public treasury;

    mapping(uint256 => uint256) public stakeOf;
    mapping(uint256 => uint64) public unstakeRequestedAt;
    mapping(uint256 => bytes32) public lastEvidenceHash;
    uint256 public totalSlashed;

    event Staked(uint256 indexed agentId, address indexed from, uint256 amount, uint256 newTotal);
    event UnstakeInitiated(uint256 indexed agentId, uint256 amount, uint64 availableAt);
    event UnstakeCancelled(uint256 indexed agentId);
    event Unstaked(uint256 indexed agentId, uint256 amount);
    event Slashed(uint256 indexed agentId, uint256 amount, bytes32 indexed evidenceHash, uint256 remaining);
    event SlashAuthorityTransferred(address indexed previous, address indexed next);

    error NotAgentOwner();
    error NotSlashAuthority();
    error NothingStaked();
    error CooldownNotElapsed();
    error InsufficientStake();
    error ZeroAmount();

    modifier onlyAgentOwner(uint256 agentId) {
        if (registry.agentIdByOwner(msg.sender) != agentId) revert NotAgentOwner();
        _;
    }

    modifier onlySlashAuthority() {
        if (msg.sender != slashAuthority) revert NotSlashAuthority();
        _;
    }

    constructor(address registry_, address treasury_) {
        registry = IAgentRegistry(registry_);
        slashAuthority = msg.sender;
        treasury = treasury_;
    }

    /// @notice Stake native currency for your own agent. Resets any pending unstake.
    function stake(uint256 agentId) external payable onlyAgentOwner(agentId) {
        if (msg.value == 0) revert ZeroAmount();
        stakeOf[agentId] += msg.value;
        unstakeRequestedAt[agentId] = 0;
        emit Staked(agentId, msg.sender, msg.value, stakeOf[agentId]);
    }

    function initiateUnstake(uint256 agentId) external onlyAgentOwner(agentId) {
        if (stakeOf[agentId] == 0) revert NothingStaked();
        unstakeRequestedAt[agentId] = uint64(block.timestamp);
        emit UnstakeInitiated(agentId, stakeOf[agentId], uint64(block.timestamp) + uint64(UNSTAKE_COOLDOWN));
    }

    function cancelUnstake(uint256 agentId) external onlyAgentOwner(agentId) {
        unstakeRequestedAt[agentId] = 0;
        emit UnstakeCancelled(agentId);
    }

    function completeUnstake(uint256 agentId) external onlyAgentOwner(agentId) {
        uint64 requestedAt = unstakeRequestedAt[agentId];
        if (requestedAt == 0) revert NothingStaked();
        if (block.timestamp < requestedAt + UNSTAKE_COOLDOWN) revert CooldownNotElapsed();

        uint256 amount = stakeOf[agentId];
        stakeOf[agentId] = 0;
        unstakeRequestedAt[agentId] = 0;
        (address owner,) = registry.agentById(agentId);
        (bool ok, ) = payable(owner).call{value: amount}("");
        require(ok, "Transfer failed");
        emit Unstaked(agentId, amount);
    }

    /// @notice Slash a stake with public evidence. Governance-keyed in MVP.
    function slash(uint256 agentId, uint256 amount, bytes32 evidenceHash) external onlySlashAuthority {
        if (amount == 0) revert ZeroAmount();
        uint256 staked = stakeOf[agentId];
        if (staked < amount) revert InsufficientStake();

        stakeOf[agentId] = staked - amount;
        unstakeRequestedAt[agentId] = 0;
        lastEvidenceHash[agentId] = evidenceHash;
        totalSlashed += amount;
        (bool ok, ) = payable(treasury).call{value: amount}("");
        require(ok, "Transfer failed");
        emit Slashed(agentId, amount, evidenceHash, stakeOf[agentId]);
    }

    function setSlashAuthority(address next) external onlySlashAuthority {
        emit SlashAuthorityTransferred(slashAuthority, next);
        slashAuthority = next;
    }
}
