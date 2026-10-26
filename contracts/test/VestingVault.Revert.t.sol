// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VestingVaultTestBase} from "./VestingVault.Base.t.sol";
import {VestingVault} from "../VestingVault.sol";

contract VestingVaultRevertTest is VestingVaultTestBase {

    // ── createSchedule revert paths ──────────────────────────────────────────

    function test_Create_ZeroBeneficiary_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(VestingVault.ZeroAddress.selector);
        vault.createSchedule(address(0), AMOUNT, 0, DURATION);
    }

    function test_Create_ZeroAmount_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(VestingVault.ZeroAmount.selector);
        vault.createSchedule(bob, 0, 0, DURATION);
    }

    function test_Create_ZeroDuration_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(VestingVault.ZeroDuration.selector);
        vault.createSchedule(bob, AMOUNT, 0, 0);
    }

    function test_Create_DurationTooLong_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(VestingVault.DurationTooLong.selector);
        vault.createSchedule(bob, AMOUNT, 0, MAX_DUR + 1);
    }

    function test_Create_StartInPast_Reverts() public {
        // Warp to a meaningful timestamp so "now - 1" is unambiguously in the past
        // (the forge genesis timestamp is 1, so block.timestamp - 1 == 0 which triggers
        //  the "startTime == 0 means now" branch instead of the StartInPast check).
        vm.warp(1_000_000);
        uint256 past = block.timestamp - 1;
        vm.prank(alice);
        vm.expectRevert(VestingVault.StartInPast.selector);
        vault.createSchedule(bob, AMOUNT, past, DURATION);
    }

    function test_Create_ScheduleAlreadyActive_Reverts() public {
        _createNow(AMOUNT, DURATION);

        _fund(alice, AMOUNT);
        vm.prank(alice);
        vm.expectRevert(VestingVault.ScheduleAlreadyActive.selector);
        vault.createSchedule(bob, AMOUNT, 0, DURATION);
    }

    function test_Create_PriorVestingNotSettled_Reverts() public {
        // Create and cancel mid-way (vested != 0, so amount != claimed after cancel)
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(alice);
        vault.cancel(bob);

        // Do NOT claimAfterCancel — now amount (frozen vested) != claimed
        _fund(alice, AMOUNT);
        vm.prank(alice);
        vm.expectRevert(VestingVault.PriorVestingNotSettled.selector);
        vault.createSchedule(bob, AMOUNT, 0, DURATION);
    }

    function test_Create_OverflowGuard_Reverts() public {
        // resolvedStart near max + huge duration → overflow
        uint256 hugeStart = type(uint256).max - 1;
        vm.warp(hugeStart);
        vm.prank(alice);
        vm.expectRevert(VestingVault.StartTimePlusOverflow.selector);
        vault.createSchedule(bob, AMOUNT, hugeStart, MAX_DUR);
    }

    // ── claim revert paths (duplicated here for completeness) ────────────────

    function test_Claim_NothingToClaim_VaultEmpty_Reverts() public {
        // schedule exists but before start → nothing claimable
        uint256 future = block.timestamp + 7 days;
        _createAt(AMOUNT, future, DURATION);

        vm.prank(bob);
        vm.expectRevert(VestingVault.NothingToClaim.selector);
        vault.claim(alice);
    }

    // ── cancel revert path: wrong sender sees NoActiveSchedule ──────────────

    function test_Cancel_WrongSender_SeesNoActiveSchedule() public {
        _createNow(AMOUNT, DURATION);

        // carol has no schedule for bob
        vm.prank(carol);
        vm.expectRevert(VestingVault.NoActiveSchedule.selector);
        vault.cancel(bob);
    }

    // ── MAX_DURATION boundary ────────────────────────────────────────────────

    function test_Create_MaxDurationExact_Succeeds() public {
        vm.prank(alice);
        vault.createSchedule(bob, AMOUNT, 0, MAX_DUR);
        // Just verify claimable is 0 at the start
        assertEq(vault.claimable(alice, bob), 0);
    }
}
