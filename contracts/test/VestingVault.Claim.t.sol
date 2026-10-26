// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VestingVaultTestBase} from "./VestingVault.Base.t.sol";
import {VestingVault} from "../VestingVault.sol";

contract VestingVaultClaimTest is VestingVaultTestBase {

    // ── claim – happy path: partial then full ────────────────────────────────

    function test_Claim_Partial_TransfersCorrectAmount() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        uint256 expected = vault.claimable(alice, bob);
        uint256 before   = usdc.balanceOf(bob);

        vm.expectEmit(true, true, false, true, address(vault));
        emit VestingVault.Claimed(alice, bob, expected);

        vm.prank(bob);
        vault.claim(alice);

        assertEq(usdc.balanceOf(bob), before + expected);
    }

    function test_Claim_Full_DeletesStorage() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(bob);
        vault.claim(alice);

        // Storage deleted → vestedAmount and claimable both 0
        assertEq(vault.vestedAmount(alice, bob), 0);
        assertEq(vault.claimable(alice, bob), 0);
    }

    function test_Claim_Full_ReceivesFullAmount() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION + 1);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        vault.claim(alice);
        assertEq(usdc.balanceOf(bob), before + AMOUNT);
    }

    function test_Claim_PartialThenFull_Correct() public {
        _createNow(AMOUNT, DURATION);
        uint256 ts = block.timestamp;

        // --- first claim at 50% ---
        vm.warp(ts + DURATION / 2);
        uint256 firstClaim = vault.claimable(alice, bob);
        vm.prank(bob);
        vault.claim(alice);

        // --- second claim at 100% ---
        vm.warp(ts + DURATION + 1);
        uint256 secondClaim = vault.claimable(alice, bob);
        vm.prank(bob);
        vault.claim(alice);

        // Total received == AMOUNT (allow ±1 for integer division)
        assertApproxEqAbs(firstClaim + secondClaim, AMOUNT, 1);
    }

    // ── claim – explicit future startTime ────────────────────────────────────

    function test_Claim_BeforeStart_Reverts() public {
        uint256 future = block.timestamp + 7 days;
        _createAt(AMOUNT, future, DURATION);

        vm.prank(bob);
        vm.expectRevert(VestingVault.NothingToClaim.selector);
        vault.claim(alice);
    }

    function test_Claim_AfterFutureStart_Works() public {
        uint256 future = block.timestamp + 7 days;
        _createAt(AMOUNT, future, DURATION);

        vm.warp(future + DURATION + 1);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        vault.claim(alice);
        assertEq(usdc.balanceOf(bob), before + AMOUNT);
    }

    // ── claim – after full claim, can create new schedule ───────────────────

    function test_CreateSchedule_AfterFullClaim_Succeeds() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(bob);
        vault.claim(alice);

        // Storage cleaned up → new schedule allowed
        _fund(alice, AMOUNT); // top up alice
        _createNow(AMOUNT, DURATION);
        assertEq(vault.claimable(alice, bob), 0); // nothing claimable yet (just started)
    }

    // ── claim – revert paths ─────────────────────────────────────────────────

    function test_Claim_NoSchedule_Reverts() public {
        vm.prank(bob);
        vm.expectRevert(VestingVault.NoActiveSchedule.selector);
        vault.claim(alice);
    }

    function test_Claim_WrongCaller_Reverts() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        // stranger is not the beneficiary (bob)
        vm.prank(stranger);
        vm.expectRevert(VestingVault.NoActiveSchedule.selector);
        vault.claim(alice);
    }
}
