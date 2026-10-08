// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {StakeVault} from "../src/StakeVault.sol";
import {EscrowHub} from "../src/EscrowHub.sol";

/// @notice Deploys the Sable P0 contract stack and writes a machine-readable
/// deployments/<chainId>.json that the indexer, SDK and app consume.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        AgentRegistry registry = new AgentRegistry();
        StakeVault vault = new StakeVault(address(registry), msg.sender);
        EscrowHub escrow = new EscrowHub(address(registry));

        vm.stopBroadcast();

        string memory json = string.concat(
            '{"chainId":', vm.toString(block.chainid),
            ',"agentRegistry":"', vm.toString(address(registry)),
            '","stakeVault":"', vm.toString(address(vault)),
            '","escrowHub":"', vm.toString(address(escrow)),
            '","deployedAt":', vm.toString(block.timestamp), '}'
        );
        vm.createDir("deployments", true);
        vm.writeFile(string.concat("deployments/", vm.toString(block.chainid), ".json"), json);

        console2.log("AgentRegistry:", address(registry));
        console2.log("StakeVault:   ", address(vault));
        console2.log("EscrowHub:    ", address(escrow));
        console2.log("Deployer:     ", vm.toString(deployer));
    }
}
