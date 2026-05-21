// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CommunityEscrow.sol";

/// @title DeployScript
/// @notice Deploys CommunityEscrow to ARC testnet.
///
/// Usage:
///   forge script script/Deploy.s.sol:DeployScript \
///     --rpc-url arc_testnet \
///     --private-key $RELAY_PRIVATE_KEY \
///     --broadcast
///
/// The deployer address (derived from RELAY_PRIVATE_KEY) becomes both:
///   - the relay wallet (authorised to call releaseStake / slashStake)
///   - the default potAddress registered per community
///
/// After deploy, note the contract address and set:
///   NEXT_PUBLIC_ARC_ESCROW_ADDRESS=<deployed address>
///   in frontend/.env.local
contract DeployScript is Script {
    // ARC testnet USDC — fixed address, do not change
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 deployerKey = vm.envUint("RELAY_PRIVATE_KEY");
        address relay = vm.addr(deployerKey);

        console.log("Deploying CommunityEscrow...");
        console.log("  Relay wallet:", relay);
        console.log("  USDC address:", USDC);

        vm.startBroadcast(deployerKey);
        CommunityEscrow escrow = new CommunityEscrow(USDC, relay);
        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("CommunityEscrow deployed at:", address(escrow));
        console.log("Relay / pot address:        ", relay);
        console.log("");
        console.log("Add to frontend/.env.local:");
        console.log(string.concat("NEXT_PUBLIC_ARC_ESCROW_ADDRESS=", vm.toString(address(escrow))));
        console.log(string.concat("NEXT_PUBLIC_RELAY_PRIVATE_KEY=  <your key>"));
    }
}
