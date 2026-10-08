// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAgentRegistry {
    function agentIdByOwner(address owner) external view returns (uint256);
    function agentById(uint256 agentId) external view returns (address owner, bool active);
    function agentIdByDid(string calldata did) external view returns (uint256);
}
