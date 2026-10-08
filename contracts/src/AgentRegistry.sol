// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AgentRegistry — ERC-8004-style onchain agent identity (Sable Layer 1)
/// @notice One agent = one wallet = one DID. Identity only; reputation is earned in Layer 2.
contract AgentRegistry {
    struct Agent {
        address owner;
        string did;
        string metadataURI;
        string endpoint;
        bytes32 metadataHash;
        bool active;
        uint64 registeredAt;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) internal _agents;
    mapping(string => uint256) public agentIdByDid;
    mapping(address => uint256) public agentIdByOwner;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string did, string metadataURI, string endpoint, bytes32 metadataHash);
    event AgentUpdated(uint256 indexed agentId, string metadataURI, string endpoint, bytes32 metadataHash);
    event AgentStatusChanged(uint256 indexed agentId, bool active);

    error NotOwner();
    error DidTaken();
    error WalletAlreadyRegistered();
    error UnknownAgent();
    error EmptyDid();
    modifier onlyOwner(uint256 agentId) {
        if (_agents[agentId].owner != msg.sender) revert NotOwner();
        _;
    }

    /// @notice Register an agent. 1:1:1 wallet↔agent↔DID.
    /// @param did Agent DID, e.g. "did:agent:nova"
    /// @param metadataURI Offchain content-addressed JSON (name, avatar, services)
    /// @param endpoint Payment/task endpoint URL
    /// @param metadataHash keccak256 of the metadata content pinned offchain
    function register(
        string calldata did,
        string calldata metadataURI,
        string calldata endpoint,
        bytes32 metadataHash
    ) external returns (uint256 agentId) {
        if (bytes(did).length == 0) revert EmptyDid();
        if (agentIdByOwner[msg.sender] != 0) revert WalletAlreadyRegistered();
        if (agentIdByDid[did] != 0) revert DidTaken();

        agentId = nextAgentId++;
        _agents[agentId] = Agent({
            owner: msg.sender,
            did: did,
            metadataURI: metadataURI,
            endpoint: endpoint,
            metadataHash: metadataHash,
            active: true,
            registeredAt: uint64(block.timestamp)
        });
        agentIdByDid[did] = agentId;
        agentIdByOwner[msg.sender] = agentId;

        emit AgentRegistered(agentId, msg.sender, did, metadataURI, endpoint, metadataHash);
    }

    function update(uint256 agentId, string calldata metadataURI, string calldata endpoint, bytes32 metadataHash)
        external
        onlyOwner(agentId)
    {
        Agent storage a = _agents[agentId];
        a.metadataURI = metadataURI;
        a.endpoint = endpoint;
        a.metadataHash = metadataHash;
        emit AgentUpdated(agentId, metadataURI, endpoint, metadataHash);
    }

    function setActive(uint256 agentId, bool active) external onlyOwner(agentId) {
        _agents[agentId].active = active;
        emit AgentStatusChanged(agentId, active);
    }

    function resolve(string calldata did) external view returns (Agent memory) {
        uint256 agentId = agentIdByDid[did];
        if (agentId == 0) revert UnknownAgent();
        return _agents[agentId];
    }

    function agentById(uint256 agentId) external view returns (address owner, bool active) {
        Agent storage a = _agents[agentId];
        return (a.owner, a.active);
    }

    function didOf(uint256 agentId) external view returns (string memory) {
        return _agents[agentId].did;
    }
}
