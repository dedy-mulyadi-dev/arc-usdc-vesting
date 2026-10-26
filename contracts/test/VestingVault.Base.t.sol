// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {VestingVault} from "../VestingVault.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Shared setup and helpers used by all VestingVault test categories.
abstract contract VestingVaultTestBase is Test {
    // ── Actors ──────────────────────────────────────────────────────────────
    address internal alice    = makeAddr("alice");    // sender / schedule creator
    address internal bob      = makeAddr("bob");      // beneficiary
    address internal carol    = makeAddr("carol");    // second sender
    address internal dave     = makeAddr("dave");     // second beneficiary
    address internal stranger = makeAddr("stranger"); // unauthorised caller

    // ── Constants ────────────────────────────────────────────────────────────
    uint256 internal constant AMOUNT   = 1_200e6;     // 1 200 USDC (6 dp)
    uint256 internal constant DURATION = 365 days;
    uint256 internal constant MAX_DUR  = 10 * 365 days;

    // ── Contracts ────────────────────────────────────────────────────────────
    MockERC20    internal usdc;
    VestingVault internal vault;

    // ── Setup ────────────────────────────────────────────────────────────────
    function setUp() public virtual {
        usdc  = new MockERC20("Mock USDC", "mUSDC", 6);
        vault = new VestingVault(address(usdc));

        // Fund alice and carol so they can createSchedule
        _fund(alice,  10_000e6);
        _fund(carol,  10_000e6);
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    /// Mint tokens to `who` and pre-approve the vault.
    function _fund(address who, uint256 amt) internal {
        usdc.mint(who, amt);
        vm.prank(who);
        usdc.approve(address(vault), type(uint256).max);
    }

    /// alice creates a schedule for bob starting now.
    function _createNow(uint256 amount, uint256 duration) internal {
        vm.prank(alice);
        vault.createSchedule(bob, amount, 0, duration);
    }

    /// alice creates a schedule for bob with an explicit start time.
    function _createAt(uint256 amount, uint256 startTime, uint256 duration) internal {
        vm.prank(alice);
        vault.createSchedule(bob, amount, startTime, duration);
    }
}
