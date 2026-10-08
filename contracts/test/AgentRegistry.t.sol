// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry registry;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        registry = new AgentRegistry();
    }

    function test_RegisterAndResolve() public {
        vm.prank(alice);
        uint256 agentId = registry.register("did:agent:alice", "ipfs://meta", "https://alice.example/pay", keccak256("meta"));
        assertEq(agentId, 1);

        AgentRegistry.Agent memory a = registry.resolve("did:agent:alice");
        assertEq(a.owner, alice);
        assertEq(a.endpoint, "https://alice.example/pay");
        assertTrue(a.active);
        assertEq(a.registeredAt, block.timestamp);
    }

    function test_OneWalletOneAgent_OneDidOneAgent() public {
        vm.startPrank(alice);
        registry.register("did:agent:alice", "ipfs://meta", "https://alice.example/pay", keccak256("meta"));
        vm.expectRevert(AgentRegistry.WalletAlreadyRegistered.selector);
        registry.register("did:agent:other", "ipfs://m2", "https://x", keccak256("m2"));
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(AgentRegistry.DidTaken.selector);
        registry.register("did:agent:alice", "ipfs://m3", "https://x", keccak256("m3"));
    }

    function test_UpdateAndDeactivate() public {
        vm.startPrank(alice);
        uint256 agentId = registry.register("did:agent:alice", "ipfs://meta", "https://alice.example/pay", keccak256("meta"));
        registry.update(agentId, "ipfs://meta2", "https://alice2.example/pay", keccak256("meta2"));
        registry.setActive(agentId, false);
        vm.stopPrank();

        (, bool active) = registry.agentById(agentId);
        assertFalse(active);

        vm.prank(bob);
        vm.expectRevert(AgentRegistry.NotOwner.selector);
        registry.setActive(agentId, true);
    }

    function test_ResolveUnknownDid() public {
        vm.expectRevert(AgentRegistry.UnknownAgent.selector);
        registry.resolve("did:agent:ghost");
    }

    function test_CannotRegisterEmptyDid() public {
        vm.prank(alice);
        vm.expectRevert(AgentRegistry.EmptyDid.selector);
        registry.register("", "ipfs://m", "https://x", keccak256("m"));
    }
}
