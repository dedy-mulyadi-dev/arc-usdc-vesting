// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VestingVaultTestBase} from "./VestingVault.Base.t.sol";
import {VestingVault} from "../VestingVault.sol";

contract VestingVaultCancelTest is VestingVaultTestBase {

    // ── cancel mid-way ───────────────────────────────────────────────────────

    function test_Cancel_MidWay_SenderGetsUnvested() public {
        _createNow(AMOUNT, DURATION);
        uint256 ts = block.timestamp;

        vm.warp(ts + DURATION / 2);
        uint256 vested   = vault.vestedAmount(alice, bob);
        uint256 unvested = AMOUNT - vested;

        uint256 before = usdc.balanceOf(alice);

        vm.expectEmit(true, true, false, true, address(vault));
        emit VestingVault.Cancelled(alice, bob, unvested);

        vm.prank(alice);
        vault.cancel(bob);

        assertEq(usdc.balanceOf(alice), before + unvested);
    }

    function test_Cancel_MidWay_ClaimableFreezesToVested() public {
        _createNow(AMOUNT, DURATION);
        uint256 ts = block.timestamp;

        vm.warp(ts + DURATION / 2);
        uint256 vested = vault.vestedAmount(alice, bob);

        vm.prank(alice);
        vault.cancel(bob);

        // After cancel, claimable == frozen vested portion
        assertApproxEqAbs(vault.claimable(alice, bob), vested, 1);
    }

    function test_Cancel_MidWay_VestedAmountBecomesZero() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(alice);
        vault.cancel(bob);

        // vestedAmount returns 0 for cancelled schedules
        assertEq(vault.vestedAmount(alice, bob), 0);
    }

    // ── cancel at t=0 (nothing vested) ───────────────────────────────────────

    function test_Cancel_AtStart_SenderGetsFullAmount() public {
        _createNow(AMOUNT, DURATION);
        // Cancel immediately — nothing has vested
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.cancel(bob);
        assertEq(usdc.balanceOf(alice), before + AMOUNT);
    }

    function test_Cancel_AtStart_ClaimableIsZero() public {
        _createNow(AMOUNT, DURATION);
        vm.prank(alice);
        vault.cancel(bob);
        assertEq(vault.claimable(alice, bob), 0);
    }

    // ── claimAfterCancel ─────────────────────────────────────────────────────

    function test_ClaimAfterCancel_BeneficiaryGetsVestedRemainder() public {
        _createNow(AMOUNT, DURATION);
        uint256 ts = block.timestamp;

        vm.warp(ts + DURATION / 2);
        uint256 vested = vault.vestedAmount(alice, bob);

        vm.prank(alice);
        vault.cancel(bob);

        uint256 before = usdc.balanceOf(bob);

        vm.expectEmit(true, true, false, true, address(vault));
        emit VestingVault.Claimed(alice, bob, vested);

        vm.prank(bob);
        vault.claimAfterCancel(alice);

        assertApproxEqAbs(usdc.balanceOf(bob), before + vested, 1);
    }

    function test_ClaimAfterCancel_DeletesStorage() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(alice);
        vault.cancel(bob);

        vm.prank(bob);
        vault.claimAfterCancel(alice);

        // Storage cleaned → claimable returns 0
        assertEq(vault.claimable(alice, bob), 0);
    }

    function test_ClaimAfterCancel_ThenNewScheduleAllowed() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(alice);
        vault.cancel(bob);

        vm.prank(bob);
        vault.claimAfterCancel(alice);

        // Can now create fresh schedule for same alice→bob pair
        _fund(alice, AMOUNT);
        _createNow(AMOUNT, DURATION);
        // vault holds a fresh schedule amount
        assertEq(usdc.balanceOf(address(vault)), AMOUNT);
    }

    // ── cancel then partial claimAfterCancel then new schedule blocked ────────

    function test_ClaimAfterCancel_Partial_ThenNewScheduleBlocked() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(alice);
        vault.cancel(bob);

        // Do NOT claimAfterCancel — PriorVestingNotSettled should block new schedule
        _fund(alice, AMOUNT);
        vm.prank(alice);
        vm.expectRevert(VestingVault.PriorVestingNotSettled.selector);
        vault.createSchedule(bob, AMOUNT, 0, DURATION);
    }

    // ── cancel – revert paths ─────────────────────────────────────────────────

    function test_Cancel_NoSchedule_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(VestingVault.NoActiveSchedule.selector);
        vault.cancel(bob);
    }

    function test_Cancel_WrongCaller_Reverts() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        // stranger is not alice (the sender)
        vm.prank(stranger);
        vm.expectRevert(VestingVault.NoActiveSchedule.selector);
        vault.cancel(bob);
    }

    function test_Cancel_FullyVested_Reverts() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(alice);
        vm.expectRevert(VestingVault.NothingToCancel.selector);
        vault.cancel(bob);
    }

    // ── claimAfterCancel – revert paths ──────────────────────────────────────

    function test_ClaimAfterCancel_OnActiveSchedule_Reverts() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        // Schedule is still active — not cancelled
        vm.prank(bob);
        vm.expectRevert(VestingVault.NoActiveSchedule.selector);
        vault.claimAfterCancel(alice);
    }

    function test_ClaimAfterCancel_NoSchedule_Reverts() public {
        vm.prank(bob);
        vm.expectRevert(VestingVault.NoActiveSchedule.selector);
        vault.claimAfterCancel(alice);
    }

    function test_ClaimAfterCancel_AlreadyFullyClaimed_Reverts() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(alice);
        vault.cancel(bob);

        // First claim fully drains it
        vm.prank(bob);
        vault.claimAfterCancel(alice);

        // Second call — storage deleted, so no cancelled schedule exists
        vm.prank(bob);
        vm.expectRevert(VestingVault.NoActiveSchedule.selector);
        vault.claimAfterCancel(alice);
    }

    function test_ClaimAfterCancel_WrongCaller_Reverts() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(alice);
        vault.cancel(bob);

        // stranger is not bob (the beneficiary)
        vm.prank(stranger);
        vm.expectRevert(VestingVault.NoActiveSchedule.selector);
        vault.claimAfterCancel(alice);
    }
}
