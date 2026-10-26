// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VestingVaultTestBase} from "./VestingVault.Base.t.sol";
import {VestingVault} from "../VestingVault.sol";

contract VestingVaultDeployTest is VestingVaultTestBase {
    // ── Constructor ──────────────────────────────────────────────────────────

    function test_Constructor_SetsUsdc() public view {
        assertEq(address(vault.usdc()), address(usdc));
    }

    function test_Constructor_StoresDecimals() public view {
        assertEq(vault.usdcDecimals(), 6);
    }

    function test_Constructor_ZeroAddress_Reverts() public {
        vm.expectRevert(VestingVault.ZeroAddress.selector);
        new VestingVault(address(0));
    }

    // ── createSchedule – happy paths ─────────────────────────────────────────

    function test_CreateSchedule_StartTimeZero_UsesNow() public {
        uint256 ts = block.timestamp;
        vm.expectEmit(true, true, false, true, address(vault));
        emit VestingVault.ScheduleCreated(alice, bob, AMOUNT, ts, DURATION);
        _createNow(AMOUNT, DURATION);
    }

    function test_CreateSchedule_ExplicitFuture_Works() public {
        uint256 future = block.timestamp + 1 days;
        vm.expectEmit(true, true, false, true, address(vault));
        emit VestingVault.ScheduleCreated(alice, bob, AMOUNT, future, DURATION);
        _createAt(AMOUNT, future, DURATION);
    }

    function test_CreateSchedule_TransfersTokensToVault() public {
        uint256 before = usdc.balanceOf(address(vault));
        _createNow(AMOUNT, DURATION);
        assertEq(usdc.balanceOf(address(vault)), before + AMOUNT);
    }

    function test_CreateSchedule_DeductsFromSender() public {
        uint256 before = usdc.balanceOf(alice);
        _createNow(AMOUNT, DURATION);
        assertEq(usdc.balanceOf(alice), before - AMOUNT);
    }

    // ── vestedAmount – before/after/mid ──────────────────────────────────────

    function test_VestedAmount_BeforeStart_IsZero() public {
        uint256 future = block.timestamp + 7 days;
        _createAt(AMOUNT, future, DURATION);
        // still before start
        assertEq(vault.vestedAmount(alice, bob), 0);
    }

    function test_VestedAmount_AtStart_IsZero() public {
        uint256 start = block.timestamp + 1;
        _createAt(AMOUNT, start, DURATION);
        vm.warp(start);
        assertEq(vault.vestedAmount(alice, bob), 0);
    }

    function test_VestedAmount_MidWay_IsHalf() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);
        uint256 vested = vault.vestedAmount(alice, bob);
        // Allow ±1 for integer division
        assertApproxEqAbs(vested, AMOUNT / 2, 1);
    }

    function test_VestedAmount_AfterEnd_IsFullAmount() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION + 1);
        assertEq(vault.vestedAmount(alice, bob), AMOUNT);
    }

    // ── claimable ────────────────────────────────────────────────────────────

    function test_Claimable_NoSchedule_IsZero() public view {
        assertEq(vault.claimable(alice, bob), 0);
    }

    function test_Claimable_BeforeStart_IsZero() public {
        uint256 future = block.timestamp + 7 days;
        _createAt(AMOUNT, future, DURATION);
        assertEq(vault.claimable(alice, bob), 0);
    }

    function test_Claimable_MidWay_EqualsVested() public {
        _createNow(AMOUNT, DURATION);
        vm.warp(block.timestamp + DURATION / 2);
        uint256 vested    = vault.vestedAmount(alice, bob);
        uint256 claimable = vault.claimable(alice, bob);
        assertEq(claimable, vested);
    }
}
