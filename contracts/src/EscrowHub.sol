// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAgentRegistry} from "./IAgentRegistry.sol";

/// @title EscrowHub — task escrow state machine (Sable Layer 2, the heart of the product)
/// @notice Every transition emits a typed event the deterministic scorer consumes.
/// Funded -> Accepted -> Delivered -> Settled | Disputed -> {Resolved(settled|refunded)}
/// Funded/Accepted -> TimedOut. Pre-acceptance Refunded is a neutral cancel.
contract EscrowHub {
    enum Status {None, Funded, Accepted, Delivered, Disputed, Settled, Refunded, TimedOut}

    struct Task {
        uint256 hirerAgentId;
        uint256 providerAgentId;
        address hirer;
        address provider;
        uint256 amount;
        bytes32 specHash;
        bytes32 deliverableHash;
        Status status;
        uint64 createdAt;
        uint64 timeoutAt;
    }

    IAgentRegistry public immutable registry;
    address public arbiter; // bonded-arbiter marketplace in the roadmap; deployer in dev
    uint256 public nextTaskId = 1;
    mapping(uint256 => Task) internal _tasks;

    event TaskCreated(uint256 indexed taskId, uint256 indexed hirerAgentId, uint256 indexed providerAgentId, address hirer, uint256 amount, bytes32 specHash, uint64 timeoutAt);
    event TaskAccepted(uint256 indexed taskId, uint256 indexed providerAgentId);
    event TaskDelivered(uint256 indexed taskId, bytes32 indexed deliverableHash);
    event TaskSettled(uint256 indexed taskId, uint256 indexed providerAgentId, uint256 indexed hirerAgentId, uint256 amount);
    event TaskDisputed(uint256 indexed taskId, uint256 indexed hirerAgentId, uint256 indexed providerAgentId);
    event TaskResolved(uint256 indexed taskId, bool providerWins);
    event TaskRefunded(uint256 indexed taskId, uint256 indexed hirerAgentId, uint256 indexed providerAgentId, bool afterAccept);
    event TaskTimedOut(uint256 indexed taskId, uint256 indexed hirerAgentId, uint256 indexed providerAgentId, bool afterAccept);

    error UnknownAgent();
    error InactiveAgent();
    error SelfTask();
    error NotHirer();
    error NotProvider();
    error NotArbiter();
    error BadStatus();
    error NotTimedOut();
    error ZeroAmount();

    modifier onlyHirer(uint256 taskId) {
        if (_tasks[taskId].hirer != msg.sender) revert NotHirer();
        _;
    }

    modifier onlyProvider(uint256 taskId) {
        if (_tasks[taskId].provider != msg.sender) revert NotProvider();
        _;
    }

    constructor(address registry_) {
        registry = IAgentRegistry(registry_);
        arbiter = msg.sender;
    }

    /// @notice Create and fund a task escrow in one tx. Hirer must be a registered agent.
    function create(uint256 providerAgentId, bytes32 specHash, uint64 timeoutSeconds) external payable returns (uint256 taskId) {
        if (msg.value == 0) revert ZeroAmount();

        uint256 hirerAgentId = registry.agentIdByOwner(msg.sender);
        if (hirerAgentId == 0) revert UnknownAgent();

        (address provider, bool providerActive) = registry.agentById(providerAgentId);
        if (provider == address(0)) revert UnknownAgent();
        if (!providerActive) revert InactiveAgent();
        if (provider == msg.sender) revert SelfTask();

        taskId = nextTaskId++;
        uint64 timeoutAt = uint64(block.timestamp) + timeoutSeconds;
        _tasks[taskId] = Task({
            hirerAgentId: hirerAgentId,
            providerAgentId: providerAgentId,
            hirer: msg.sender,
            provider: provider,
            amount: msg.value,
            specHash: specHash,
            deliverableHash: bytes32(0),
            status: Status.Funded,
            createdAt: uint64(block.timestamp),
            timeoutAt: timeoutAt
        });
        emit TaskCreated(taskId, hirerAgentId, providerAgentId, msg.sender, msg.value, specHash, timeoutAt);
    }

    function accept(uint256 taskId) external onlyProvider(taskId) {
        Task storage t = _tasks[taskId];
        if (t.status != Status.Funded) revert BadStatus();
        t.status = Status.Accepted;
        emit TaskAccepted(taskId, t.providerAgentId);
    }

    function deliver(uint256 taskId, bytes32 deliverableHash) external onlyProvider(taskId) {
        Task storage t = _tasks[taskId];
        if (t.status != Status.Accepted) revert BadStatus();
        t.status = Status.Delivered;
        t.deliverableHash = deliverableHash;
        emit TaskDelivered(taskId, deliverableHash);
    }

    /// @notice Hirer accepts the deliverable; escrow settles to the provider.
    function acceptDelivery(uint256 taskId) external onlyHirer(taskId) {
        Task storage t = _tasks[taskId];
        if (t.status != Status.Delivered) revert BadStatus();
        t.status = Status.Settled;
        (bool ok, ) = payable(t.provider).call{value: t.amount}("");
        require(ok, "Transfer failed");
        emit TaskSettled(taskId, t.providerAgentId, t.hirerAgentId, t.amount);
    }

    /// @notice Hirer disputes (from Accepted or Delivered). Arbiter resolves.
    function dispute(uint256 taskId) external onlyHirer(taskId) {
        Task storage t = _tasks[taskId];
        if (t.status != Status.Delivered && t.status != Status.Accepted) revert BadStatus();
        t.status = Status.Disputed;
        emit TaskDisputed(taskId, t.hirerAgentId, t.providerAgentId);
    }

    /// @notice Arbiter resolves a dispute: providerWins -> settle to provider, else refund hirer.
    function resolve(uint256 taskId, bool providerWins) external {
        if (msg.sender != arbiter) revert NotArbiter();
        Task storage t = _tasks[taskId];
        if (t.status != Status.Disputed) revert BadStatus();

        if (providerWins) {
            t.status = Status.Settled;
            (bool ok, ) = payable(t.provider).call{value: t.amount}("");
            require(ok, "Transfer failed");
            emit TaskSettled(taskId, t.providerAgentId, t.hirerAgentId, t.amount);
        } else {
            t.status = Status.Refunded;
            (bool ok, ) = payable(t.hirer).call{value: t.amount}("");
            require(ok, "Transfer failed");
            // dispute-loss refund happens after acceptance — score-relevant
            emit TaskRefunded(taskId, t.hirerAgentId, t.providerAgentId, true);
        }
    }

    /// @notice Hirer cancels before acceptance — neutral, no score impact.
    function refund(uint256 taskId) external onlyHirer(taskId) {
        Task storage t = _tasks[taskId];
        if (t.status != Status.Funded) revert BadStatus();
        t.status = Status.Refunded;
        (bool ok, ) = payable(t.hirer).call{value: t.amount}("");
        require(ok, "Transfer failed");
        emit TaskRefunded(taskId, t.hirerAgentId, t.providerAgentId, false);
    }

    /// @notice Anyone claims a timeout.
    /// Pre-acceptance: neutral refund to hirer.
    /// Post-acceptance (undelivered): refund to hirer, counts as abandoned task against provider.
    /// Post-delivery: settlement to provider (hirer failed to accept or dispute before timeout).
    function claimTimeout(uint256 taskId) external {
        Task storage t = _tasks[taskId];
        if (block.timestamp < t.timeoutAt) revert NotTimedOut();

        if (t.status == Status.Delivered) {
            t.status = Status.Settled;
            (bool ok, ) = payable(t.provider).call{value: t.amount}("");
            require(ok, "Transfer failed");
            emit TaskSettled(taskId, t.providerAgentId, t.hirerAgentId, t.amount);
        } else if (t.status == Status.Funded || t.status == Status.Accepted) {
            bool afterAccept = t.status == Status.Accepted;
            t.status = Status.TimedOut;
            (bool ok, ) = payable(t.hirer).call{value: t.amount}("");
            require(ok, "Transfer failed");
            emit TaskTimedOut(taskId, t.hirerAgentId, t.providerAgentId, afterAccept);
        } else {
            revert BadStatus();
        }
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        return _tasks[taskId];
    }
}
