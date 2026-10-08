// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {EscrowHub} from "../src/EscrowHub.sol";

contract EscrowHubTest is Test {
    AgentRegistry registry;
    EscrowHub escrow;
    address hirer = makeAddr("hirer");
    address provider = makeAddr("provider");
    address outsider = makeAddr("outsider");
    uint256 hirerAgentId;
    uint256 providerAgentId;
    bytes32 constant SPEC = keccak256("summarize 10 PDFs");
    bytes32 constant DELIVERABLE = keccak256("summary.pdf");

    function setUp() public {
        registry = new AgentRegistry();
        escrow = new EscrowHub(address(registry));
        vm.prank(hirer);
        hirerAgentId = registry.register("did:agent:atlas", "ipfs://a", "https://atlas.example/pay", keccak256("a"));
        vm.prank(provider);
        providerAgentId = registry.register("did:agent:nova", "ipfs://n", "https://nova.example/pay", keccak256("n"));
        vm.deal(hirer, 1000 ether);
    }

    function _create(uint256 value) internal returns (uint256 taskId) {
        vm.prank(hirer);
        taskId = escrow.create{value: value}(providerAgentId, SPEC, 1 days);
    }

    function test_FullHappyPath() public {
        uint256 taskId = _create(5 ether);
        assertEq(uint8(escrow.getTask(taskId).status), uint8(EscrowHub.Status.Funded));

        vm.prank(provider);
        escrow.accept(taskId);
        vm.prank(provider);
        escrow.deliver(taskId, DELIVERABLE);

        uint256 before = provider.balance;
        vm.prank(hirer);
        escrow.acceptDelivery(taskId);
        assertEq(provider.balance, before + 5 ether);
        assertEq(uint8(escrow.getTask(taskId).status), uint8(EscrowHub.Status.Settled));
    }

    function test_CannotEscrowWithSelf() public {
        vm.deal(provider, 1 ether);
        vm.prank(provider);
        vm.expectRevert(EscrowHub.SelfTask.selector);
        escrow.create{value: 1 ether}(providerAgentId, SPEC, 1 days);
    }

    function test_OnlyRegisteredHirerCanCreate() public {
        vm.deal(outsider, 1 ether);
        vm.prank(outsider);
        vm.expectRevert(EscrowHub.UnknownAgent.selector);
        escrow.create{value: 1 ether}(providerAgentId, SPEC, 1 days);
    }

    function test_RolesAreEnforced() public {
        uint256 taskId = _create(5 ether);
        vm.prank(hirer);
        vm.expectRevert(EscrowHub.NotProvider.selector);
        escrow.accept(taskId);

        vm.prank(provider);
        escrow.accept(taskId);
        vm.prank(outsider);
        vm.expectRevert(EscrowHub.NotProvider.selector);
        escrow.deliver(taskId, DELIVERABLE);
    }

    function test_DisputeResolvedAgainstProvider() public {
        uint256 taskId = _create(5 ether);
        vm.startPrank(provider);
        escrow.accept(taskId);
        escrow.deliver(taskId, DELIVERABLE);
        vm.stopPrank();

        vm.prank(hirer);
        escrow.dispute(taskId);

        uint256 before = hirer.balance;
        escrow.resolve(taskId, false); // deployer is arbiter
        assertEq(hirer.balance, before + 5 ether);
        assertEq(uint8(escrow.getTask(taskId).status), uint8(EscrowHub.Status.Refunded));
    }

    function test_DisputeResolvedForProvider() public {
        uint256 taskId = _create(5 ether);
        vm.startPrank(provider);
        escrow.accept(taskId);
        escrow.deliver(taskId, DELIVERABLE);
        vm.stopPrank();

        vm.prank(hirer);
        escrow.dispute(taskId);

        uint256 before = provider.balance;
        escrow.resolve(taskId, true);
        assertEq(provider.balance, before + 5 ether);
        assertEq(uint8(escrow.getTask(taskId).status), uint8(EscrowHub.Status.Settled));
    }

    function test_NonArbiterCannotResolve() public {
        uint256 taskId = _create(5 ether);
        vm.startPrank(provider);
        escrow.accept(taskId);
        escrow.deliver(taskId, DELIVERABLE);
        vm.stopPrank();
        vm.prank(hirer);
        escrow.dispute(taskId);

        vm.prank(outsider);
        vm.expectRevert(EscrowHub.NotArbiter.selector);
        escrow.resolve(taskId, true);
    }

    function test_PreAcceptCancelIsNeutral() public {
        uint256 taskId = _create(5 ether);
        uint256 before = hirer.balance;
        vm.prank(hirer);
        escrow.refund(taskId);
        assertEq(hirer.balance, before + 5 ether);
        assertEq(uint8(escrow.getTask(taskId).status), uint8(EscrowHub.Status.Refunded));
    }

    function test_TimeoutPreAccept() public {
        uint256 taskId = _create(5 ether);
        vm.warp(block.timestamp + 2 days);
        uint256 before = hirer.balance;
        vm.prank(outsider); // anyone can claim a timeout
        escrow.claimTimeout(taskId);
        assertEq(hirer.balance, before + 5 ether);
        assertEq(uint8(escrow.getTask(taskId).status), uint8(EscrowHub.Status.TimedOut));
    }

    function test_TimeoutAfterAcceptCountsAgainstProvider() public {
        uint256 taskId = _create(5 ether);
        vm.prank(provider);
        escrow.accept(taskId);
        vm.warp(block.timestamp + 2 days);
        escrow.claimTimeout(taskId);
        assertEq(uint8(escrow.getTask(taskId).status), uint8(EscrowHub.Status.TimedOut));
    }

    function test_TimeoutOnlyAfterDeadline() public {
        uint256 taskId = _create(5 ether);
        vm.expectRevert(EscrowHub.NotTimedOut.selector);
        escrow.claimTimeout(taskId);
    }

    function test_InactiveProviderCannotAcceptNewTasks() public {
        vm.prank(provider);
        registry.setActive(providerAgentId, false);
        vm.prank(hirer);
        vm.expectRevert(EscrowHub.InactiveAgent.selector);
        escrow.create{value: 1 ether}(providerAgentId, SPEC, 1 days);
    }
    function test_TimeoutAfterDeliverySettlesToProvider() public {
        uint256 taskId = _create(5 ether);
        vm.prank(provider);
        escrow.accept(taskId);
        vm.prank(provider);
        escrow.deliver(taskId, DELIVERABLE);

        // Hirer does not accept or dispute before timeout
        vm.warp(block.timestamp + 2 days);
        uint256 beforeBal = provider.balance;
        escrow.claimTimeout(taskId);

        assertEq(uint8(escrow.getTask(taskId).status), uint8(EscrowHub.Status.Settled));
        assertEq(provider.balance, beforeBal + 5 ether);
    }

    function test_PayoutToSmartContractWallet() public {
        SmartWallet wallet = new SmartWallet();
        vm.prank(address(wallet));
        uint256 walletAgentId = registry.register("did:agent:wallet", "ipfs://meta", "https://w.io", keccak256("m"));

        vm.prank(hirer);
        uint256 taskId = escrow.create{value: 2 ether}(walletAgentId, SPEC, 1 days);

        vm.prank(address(wallet));
        escrow.accept(taskId);
        vm.prank(address(wallet));
        escrow.deliver(taskId, DELIVERABLE);

        vm.prank(hirer);
        escrow.acceptDelivery(taskId);

        assertEq(address(wallet).balance, 2 ether);
        assertEq(uint8(escrow.getTask(taskId).status), uint8(EscrowHub.Status.Settled));
    }
}

contract SmartWallet {
    uint256 public receivedCount;
    receive() external payable {
        // Consumes extra gas to verify .call (more than 2300 stipend)
        receivedCount++;
    }
}
