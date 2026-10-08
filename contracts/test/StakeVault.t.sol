// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {StakeVault} from "../src/StakeVault.sol";

contract StakeVaultTest is Test {
    AgentRegistry registry;
    StakeVault vault;
    address alice = makeAddr("alice");
    address attacker = makeAddr("attacker");
    uint256 agentId;

    function setUp() public {
        registry = new AgentRegistry();
        vault = new StakeVault(address(registry), makeAddr("treasury"));
        vm.prank(alice);
        agentId = registry.register("did:agent:alice", "ipfs://meta", "https://alice.example/pay", keccak256("meta"));
        vm.deal(alice, 1000 ether);
    }

    function test_StakeAccumulates() public {
        vm.startPrank(alice);
        vault.stake{value: 10 ether}(agentId);
        vault.stake{value: 5 ether}(agentId);
        vm.stopPrank();
        assertEq(vault.stakeOf(agentId), 15 ether);
    }

    function test_OnlyOwnerCanStake() public {
        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        vm.expectRevert(StakeVault.NotAgentOwner.selector);
        vault.stake{value: 1 ether}(agentId);
    }

    function test_UnstakeRequiresCooldown() public {
        vm.startPrank(alice);
        vault.stake{value: 10 ether}(agentId);
        vault.initiateUnstake(agentId);
        vm.expectRevert(StakeVault.CooldownNotElapsed.selector);
        vault.completeUnstake(agentId);

        vm.warp(block.timestamp + 7 days + 1);
        uint256 before = alice.balance;
        vault.completeUnstake(agentId);
        assertEq(alice.balance, before + 10 ether);
        assertEq(vault.stakeOf(agentId), 0);
        vm.stopPrank();
    }

    function test_StakeCancelsPendingUnstake() public {
        vm.startPrank(alice);
        vault.stake{value: 10 ether}(agentId);
        vault.initiateUnstake(agentId);
        vault.stake{value: 1 ether}(agentId);
        vm.warp(block.timestamp + 8 days);
        vm.expectRevert(StakeVault.NothingStaked.selector);
        vault.completeUnstake(agentId);
        vm.stopPrank();
        assertEq(vault.stakeOf(agentId), 11 ether);
    }

    function test_SlashReducesStakeAndPaysTreasury() public {
        vm.prank(alice);
        vault.stake{value: 10 ether}(agentId);

        address treasury = vault.treasury();
        uint256 treasuryBefore = treasury.balance;
        bytes32 evidence = keccak256("rug evidence");

        vault.slash(agentId, 4 ether, evidence);
        assertEq(vault.stakeOf(agentId), 6 ether);
        assertEq(treasury.balance, treasuryBefore + 4 ether);
        assertEq(vault.lastEvidenceHash(agentId), evidence);
        assertEq(vault.totalSlashed(), 4 ether);
    }

    function test_OnlySlashAuthorityCanSlash() public {
        vm.prank(alice);
        vault.stake{value: 10 ether}(agentId);
        vm.prank(attacker);
        vm.expectRevert(StakeVault.NotSlashAuthority.selector);
        vault.slash(agentId, 1 ether, keccak256("nope"));
    }

    function test_SlashCannotExceedStake() public {
        vm.prank(alice);
        vault.stake{value: 1 ether}(agentId);
        vm.expectRevert(StakeVault.InsufficientStake.selector);
        vault.slash(agentId, 2 ether, keccak256("too much"));
    }
}
