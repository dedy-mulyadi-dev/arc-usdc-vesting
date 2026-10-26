// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VestingVaultTestBase} from "./VestingVault.Base.t.sol";
import {VestingVault} from "../VestingVault.sol";

contract VestingVaultFuzzTest is VestingVaultTestBase {

    // ── Fuzz: vestedAmount never exceeds schedule.amount ────────────────────

    /// @dev Creates a schedule with fuzz-supplied amount / duration, warps to a
    ///      random point in time, and asserts that vestedAmount ≤ amount.
    function testFuzz_VestedAmount_NeverExceedsAmount(
        uint256 amount,
        uint256 duration,
        uint256 warpFraction  // 0..1000 → fraction of duration
    ) public {
        amount   = bound(amount,   1,       100_000e6);
        duration = bound(duration, 1 days,  MAX_DUR);

        // Fund alice with exact amount
        usdc.mint(alice, amount);
        vm.prank(alice);
        usdc.approve(address(vault), amount);

        uint256 startTime = block.timestamp;
        vm.prank(alice);
        vault.createSchedule(bob, amount, 0, duration);

        // Warp to a random fraction of the duration (0 % … 200 % to cover post-end)
        warpFraction = bound(warpFraction, 0, 200);
        uint256 delta = (duration * warpFraction) / 100;
        vm.warp(startTime + delta);

        uint256 vested = vault.vestedAmount(alice, bob);
        assertLe(vested, amount, "vested > schedule.amount");
    }

    // ── Fuzz: claimable never exceeds vestedAmount for active schedules ──────

    function testFuzz_Claimable_NeverExceedsVestedAmount(
        uint256 amount,
        uint256 duration,
        uint256 warpFraction
    ) public {
        amount   = bound(amount,   1,       100_000e6);
        duration = bound(duration, 1 days,  MAX_DUR);

        usdc.mint(alice, amount);
        vm.prank(alice);
        usdc.approve(address(vault), amount);

        uint256 startTime = block.timestamp;
        vm.prank(alice);
        vault.createSchedule(bob, amount, 0, duration);

        warpFraction = bound(warpFraction, 0, 150);
        uint256 delta = (duration * warpFraction) / 100;
        vm.warp(startTime + delta);

        uint256 vested    = vault.vestedAmount(alice, bob);
        uint256 claimable = vault.claimable(alice, bob);
        assertLe(claimable, vested, "claimable > vestedAmount for active schedule");
    }

    // ── Fuzz: linear interpolation is monotonically non-decreasing ───────────

    function testFuzz_VestedAmount_Monotone(
        uint256 amount,
        uint256 duration,
        uint256 t1Fraction,
        uint256 t2Fraction
    ) public {
        amount   = bound(amount,   1,      100_000e6);
        duration = bound(duration, 1 days, MAX_DUR);

        usdc.mint(alice, amount);
        vm.prank(alice);
        usdc.approve(address(vault), amount);

        uint256 start = block.timestamp;
        vm.prank(alice);
        vault.createSchedule(bob, amount, 0, duration);

        t1Fraction = bound(t1Fraction, 0, 100);
        t2Fraction = bound(t2Fraction, t1Fraction, 150); // t2 ≥ t1

        vm.warp(start + (duration * t1Fraction) / 100);
        uint256 v1 = vault.vestedAmount(alice, bob);

        vm.warp(start + (duration * t2Fraction) / 100);
        uint256 v2 = vault.vestedAmount(alice, bob);

        assertGe(v2, v1, "vesting went backwards");
    }

    // ── Fuzz: total claimed never exceeds amount (sequential claim loop) ─────
    //
    // Property: doing a partial claim at some point during the schedule, then a
    // final claim after it fully elapses, yields a combined total == amount (±1 wei).
    //
    // Implementation note: we skip the intermediate claim when the vested portion at
    // the warp point rounds down to zero (amount < duration seconds, extreme ratio).
    // In that case we only assert the single full-schedule claim.

    function testFuzz_TotalClaimed_NeverExceedsAmount(
        uint256 amount,
        uint256 duration,
        uint256 claimFraction   // 1..99 → fraction of duration at which to do partial claim
    ) public {
        amount        = bound(amount,        1,      100_000e6);
        duration      = bound(duration,      2 days, MAX_DUR / 10);
        claimFraction = bound(claimFraction, 1,      99);

        usdc.mint(alice, amount);
        vm.prank(alice);
        usdc.approve(address(vault), amount);

        uint256 start = block.timestamp;
        vm.prank(alice);
        vault.createSchedule(bob, amount, 0, duration);

        // Warp to partial point; ensure delta is at least 1 second.
        uint256 warpDelta = (duration * claimFraction) / 100;
        if (warpDelta == 0) warpDelta = 1;
        vm.warp(start + warpDelta);

        uint256 firstClaim;
        uint256 partialClaimable = vault.claimable(alice, bob);

        if (partialClaimable > 0) {
            uint256 firstBal = usdc.balanceOf(bob);
            vm.prank(bob);
            vault.claim(alice);
            firstClaim = usdc.balanceOf(bob) - firstBal;
        }

        // Full claim after schedule ends — always non-zero (full amount or remainder)
        vm.warp(start + duration + 1);
        uint256 secondClaim;
        {
            uint256 secondBal = usdc.balanceOf(bob);
            vm.prank(bob);
            vault.claim(alice);
            secondClaim = usdc.balanceOf(bob) - secondBal;
        }

        assertLe(firstClaim + secondClaim, amount, "total claimed > schedule.amount");
        assertApproxEqAbs(firstClaim + secondClaim, amount, 1, "total claimed != amount");
    }

    // ── Fuzz: cancel refund + beneficiary remainder == original amount ────────

    function testFuzz_Cancel_RefundPlusVested_EqualsAmount(
        uint256 amount,
        uint256 duration,
        uint256 cancelFraction  // when to cancel (1..99 % of duration)
    ) public {
        amount         = bound(amount,         1,      100_000e6);
        duration       = bound(duration,       2 days, MAX_DUR / 10);
        cancelFraction = bound(cancelFraction, 1,      99);

        usdc.mint(alice, amount);
        vm.prank(alice);
        usdc.approve(address(vault), amount);

        uint256 start = block.timestamp;
        vm.prank(alice);
        vault.createSchedule(bob, amount, 0, duration);

        vm.warp(start + (duration * cancelFraction) / 100);

        uint256 senderBefore = usdc.balanceOf(alice);
        uint256 vested       = vault.vestedAmount(alice, bob);

        vm.prank(alice);
        vault.cancel(bob);

        uint256 refund    = usdc.balanceOf(alice) - senderBefore;
        uint256 frozen    = vault.claimable(alice, bob);  // frozen vested portion

        // refund (unvested) + frozen (vested) must equal the original amount
        assertApproxEqAbs(refund + frozen, amount, 1, "refund + frozen != amount");
        assertApproxEqAbs(frozen, vested, 1, "frozen != vested at cancel");
    }
}
